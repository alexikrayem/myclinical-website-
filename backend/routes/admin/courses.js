import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { validateUploadedFile } from '../../middleware/fileValidation.js';
import { sanitizeContent } from '../../middleware/inputSanitizer.js';
import { buildFtsQuery } from '../../utils/searchUtils.js';
import { indexCourse, removeCourse } from '../../services/search/indexer.js';
import { uploadToSupabase } from './utils.js';
import logger from '../../config/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create course
router.post('/',
    authenticateToken,
    uploadLimiter,
    upload.single('cover_image'),
    validateUploadedFile(['jpg', 'jpeg', 'png']),
    [
        body('title').trim().isLength({ min: 3, max: 200 }),
        body('description').trim().isLength({ min: 10, max: 2000 }),
        body('author').trim().isLength({ min: 2, max: 200 })
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const {
            title, author, categories, is_featured, playback_provider,
            playback_source, billing_model, minute_cost, preview_source, preview_seconds
        } = req.body;

        const description = sanitizeContent(req.body.description);

        let cover_image = '';
        if (req.file) {
            cover_image = await uploadToSupabase(req.file, 'images');
        } else if (req.body.cover_image_url) {
            cover_image = req.body.cover_image_url;
        } else {
            return res.status(400).json({ error: 'Cover image is required' });
        }

        const { data, error } = await supabase
            .from('video_courses')
            .insert([{
                title, description, cover_image, playback_source,
                playback_provider: playback_provider || 'vdocipher',
                billing_model: billing_model || 'per_minute',
                minute_cost: parseInt(minute_cost) || 0,
                preview_source: preview_source || null,
                preview_seconds: parseInt(preview_seconds) || 0,
                author,
                categories: categories ? JSON.parse(categories) : [],
                credits_required: parseInt(req.body.credits_required) || 0,
                duration: parseInt(req.body.duration) || 0,
                is_featured: is_featured === 'true',
                publication_date: new Date().toISOString(),
            }])
            .select();

        if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

        try {
            await indexCourse(data[0]);
        } catch (err) {
            logger.error('Search index error (course create):', err);
        }

        res.status(201).json(data[0]);
    }));

// Update course
router.put('/:id',
    authenticateToken,
    uploadLimiter,
    upload.single('cover_image'),
    validateUploadedFile(['jpg', 'jpeg', 'png']),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const {
            title, author, categories, is_featured, playback_provider,
            playback_source, billing_model, minute_cost, preview_source, preview_seconds
        } = req.body;

        const description = sanitizeContent(req.body.description);

        const { data: existing, error: fetchErr } = await supabase
            .from('video_courses')
            .select('cover_image')
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        let cover_image = existing.cover_image;
        if (req.file) {
            cover_image = await uploadToSupabase(req.file, 'images');
        } else if (req.body.cover_image_url) {
            cover_image = req.body.cover_image_url;
        }

        const updatePayload = {
            title, description, cover_image,
            playback_provider: playback_provider || 'vdocipher',
            billing_model: billing_model || 'per_minute',
            minute_cost: parseInt(minute_cost) || 0,
            preview_source: preview_source || null,
            preview_seconds: parseInt(preview_seconds) || 0,
            author,
            categories: categories ? JSON.parse(categories) : [],
            credits_required: parseInt(req.body.credits_required) || 0,
            duration: parseInt(req.body.duration) || 0,
            is_featured: is_featured === 'true',
            updated_at: new Date().toISOString(),
        };

        if (playback_source) {
            updatePayload.playback_source = playback_source;
        }

        const { data, error } = await supabase
            .from('video_courses')
            .update(updatePayload)
            .eq('id', id)
            .select();

        if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

        try {
            await indexCourse(data[0]);
        } catch (err) {
            logger.error('Search index error (course update):', err);
        }

        res.json(data[0]);
    }));

// List courses
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { search, limit = 20, page = 1 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
        .from('video_courses')
        .select('id, title, cover_image, author, categories, is_featured, credits_required, billing_model, minute_cost, playback_provider', { count: 'exact' });

    if (search) {
        const ftsString = buildFtsQuery(search);
        if (ftsString) {
            query = query.or(`title.fts."${ftsString}",author.fts."${ftsString}"`);
        }
    }

    const { data, error, count } = await query
        .order('publication_date', { ascending: false })
        .range(offset, offset + limitNum - 1);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.json({
        data,
        pagination: {
            total: count,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil((count || 0) / limitNum)
        }
    });
}));

// Get course by id
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('video_courses')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw new AppError('Failed to fetch course', 500, 'ADMIN_COURSE_FETCH_FAILED');
    res.json(data);
}));

// Delete course
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('video_courses')
        .delete()
        .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
        await removeCourse(id);
    } catch (err) {
        logger.error('Search index error (course delete):', err);
    }

    res.json({ message: 'Course deleted successfully' });
}));

export default router;
