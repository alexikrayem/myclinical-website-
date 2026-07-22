import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import { sanitizeSearchInput } from '../../utils/searchUtils.js';
import logger from '../../config/logger.js';
import { validate } from '../../middleware/validation.js';

const router = express.Router();

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

const ALLOWED_CREDIT_TYPES = ['video', 'article', 'universal', 'both', 'research', 'all', 'typed'];
const optionalNumber = (value) => (value === undefined ? undefined : Number(value));

const generateCodesSchema = z.object({
    body: z.object({
        amount: z.preprocess(optionalNumber, z.number().int().min(1).max(100)),
        credit_value: z.preprocess(optionalNumber, z.number().int().min(0).max(1_000_000).default(0)),
        prefix: z.string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9]{2,12}$/, 'Prefix must be 2–12 uppercase alphanumeric characters')
            .default('GIFT'),
        credit_type: z.enum(ALLOWED_CREDIT_TYPES).default('universal'),
        video_minutes: z.preprocess(optionalNumber, z.number().int().min(0).max(1_000_000).default(0)),
        article_count: z.preprocess(optionalNumber, z.number().int().min(0).max(100_000).default(0)),
        research_count: z.preprocess(optionalNumber, z.number().int().min(0).max(100_000).default(0)),
        credit_type_id: z.string().uuid().optional(),
        expires_in_days: z.preprocess(optionalNumber, z.number().int().min(1).max(3650).default(365)),
    }).superRefine((data, ctx) => {
        if (data.credit_type === 'typed' && !data.credit_type_id) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'credit_type_id is required when credit_type is "typed"',
                path: ['credit_type_id'],
            });
        }
    }),
});

const reportsQuerySchema = z.object({
    query: z.object({
        search: z.string().trim().optional(),
        page: z.preprocess((v) => (v === undefined || v === '' ? 1 : Number(v)), z.number().int().min(1).default(1)),
        limit: z.preprocess((v) => (v === undefined || v === '' ? 20 : Number(v)), z.number().int().min(1).max(100).default(20)),
    }),
});

const historyQuerySchema = z.object({
    query: z.object({
        page: z.preprocess((v) => (v === undefined || v === '' ? 1 : Number(v)), z.number().int().min(1).default(1)),
        limit: z.preprocess((v) => (v === undefined || v === '' ? 20 : Number(v)), z.number().int().min(1).max(100).default(20)),
    }),
});

// ─── Utility ───────────────────────────────────────────────────────────────────

/**
 * Escape LIKE/ILIKE wildcard characters to prevent pattern injection.
 * Escapes: % _ \
 */
function escapeLikePattern(str) {
    return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/credits/generate
 * Generate license codes. Uses generate_license_codes_v4 which sets expires_at
 * and uses 8 bytes (16 hex chars) of cryptographic entropy.
 */
router.post('/generate', authenticateToken, validate(generateCodesSchema), asyncHandler(async (req, res) => {
    const {
        amount, credit_value, prefix, credit_type,
        video_minutes, article_count, research_count,
        credit_type_id, expires_in_days,
    } = req.body;

    const { data, error } = await supabase.rpc('generate_license_codes_v4', {
        p_amount: amount,
        p_credit_value: credit_value,
        p_prefix: prefix,
        p_credit_type: credit_type,
        p_video_minutes: video_minutes,
        p_article_count: article_count,
        p_research_count: research_count,
        p_credit_type_id: credit_type_id || null,
        p_expires_in_days: expires_in_days,
    });

    if (error) {
        logger.error('Error generating codes:', error);
        throw new AppError('Failed to generate codes', 500, 'ADMIN_CODES_GENERATE_FAILED');
    }

    res.json({ message: 'Codes generated successfully', codes: data });
}));

/**
 * GET /api/admin/credits/reports
 * License code redemption reports.
 */
router.get('/reports', authenticateToken, validate(reportsQuerySchema), asyncHandler(async (req, res) => {
    // `validate` replaces req.query with Zod's parsed values, so arithmetic below
    // always uses bounded integers rather than raw query-string input.
    const { search, page, limit } = req.query;
    const offset = (page - 1) * limit;

    let queryBuilder = supabase.from('admin_license_quiz_report').select('*', { count: 'exact' });

    if (search) {
        const sanitized = sanitizeSearchInput(search);
        if (sanitized) {
            // Escape ILIKE wildcards to prevent pattern injection
            const escaped = escapeLikePattern(sanitized);
            queryBuilder = queryBuilder.or(
                `code.ilike.%${escaped}%,user_email.ilike.%${escaped}%`
            );
        }
    }

    const { data, error, count } = await queryBuilder
        .range(offset, offset + limit - 1)
        .order('redeemed_at', { ascending: false });

    if (error) {
        logger.error('Error fetching license report:', error);
        throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    }

    res.json({
        data,
        pagination: {
            total: count,
            page,
            limit,
            pages: Math.ceil((count || 0) / limit),
        },
    });
}));

/**
 * GET /api/admin/credits/history
 * Full license code history (redeemed + unredeemed).
 */
router.get('/history', authenticateToken, validate(historyQuerySchema), asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    // Both page and limit are guaranteed integers by Zod at this point
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
        .from('license_codes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        logger.error('Error fetching codes history:', error);
        throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    }

    res.json({
        data,
        pagination: { total: count, page, limit, pages: Math.ceil((count || 0) / limit) },
    });
}));

/**
 * GET /api/admin/credits/types
 * List all credit types with their linked course IDs.
 */
router.get('/types', authenticateToken, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('credit_types')
        .select('*, credit_type_courses(course_id)')
        .order('created_at', { ascending: false });

    if (error) throw new AppError('Failed to fetch credit types', 500, 'ADMIN_CREDIT_TYPES_FETCH_FAILED');

    res.json(data.map(ct => ({
        ...ct,
        course_ids: (ct.credit_type_courses || []).map(c => c.course_id),
        credit_type_courses: undefined,
    })));
}));

export default router;
