import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { authenticateUser, optionalAuth } from '../middleware/userAuth.js';

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/credits/balance
 * Get user's complete credit balance (requires authentication)
 */
router.get('/balance', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('user_credits')
            .select('balance, video_watch_minutes, article_credits, total_earned, total_spent')
            .eq('custom_user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // If no record exists, return 0 balances
        if (!data) {
            return res.json({
                balance: 0,
                video_watch_minutes: 0,
                article_credits: 0,
                total_earned: 0,
                total_spent: 0
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching credit balance:', error);
        res.status(500).json({ error: 'فشل في جلب الرصيد' });
    }
});

/**
 * POST /api/credits/redeem
 * Redeem a license code (supports video, article, universal, or both types)
 */
router.post('/redeem', authenticateUser, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;

        if (!code) {
            return res.status(400).json({ error: 'الكود مطلوب' });
        }

        // Normalize code (uppercase, trim)
        const normalizedCode = code.trim().toUpperCase();

        // Call the secure database function to redeem code
        const { data, error } = await supabase
            .rpc('redeem_license_code_v2', {
                p_code: normalizedCode,
                p_user_id: userId
            });

        if (error) {
            console.error('RPC Error:', error);
            // Fall back to the old function if v2 doesn't exist
            const { data: legacyData, error: legacyError } = await supabase
                .rpc('redeem_license_code', { p_code: normalizedCode });

            if (legacyError) throw legacyError;
            if (!legacyData.success) {
                return res.status(400).json({ error: legacyData.message });
            }
            return res.json(legacyData);
        }

        if (!data.success) {
            return res.status(400).json({ error: data.message });
        }

        res.json({
            success: true,
            message: data.message,
            credits: {
                balance: data.new_balance,
                video_minutes: data.video_minutes,
                article_credits: data.article_credits
            },
            credit_type: data.credit_type
        });
    } catch (error) {
        console.error('Error redeeming code:', error);
        res.status(500).json({ error: 'فشل في استخدام الكود' });
    }
});

/**
 * POST /api/credits/consume-video
 * Consume video watch time credits
 */
router.post('/consume-video', authenticateUser, async (req, res) => {
    try {
        const { minutes, course_id } = req.body;
        const userId = req.user.id;

        if (!minutes || minutes <= 0) {
            return res.status(400).json({ error: 'عدد الدقائق مطلوب' });
        }

        if (!course_id) {
            return res.status(400).json({ error: 'معرف الدورة مطلوب' });
        }

        const { data, error } = await supabase
            .rpc('consume_video_minutes', {
                p_user_id: userId,
                p_minutes: Math.ceil(minutes),
                p_course_id: course_id
            });

        if (error) throw error;

        if (!data.success) {
            return res.status(400).json({ error: data.message });
        }

        res.json({
            success: true,
            remaining_minutes: data.remaining_minutes,
            remaining_balance: data.remaining_balance
        });
    } catch (error) {
        console.error('Error consuming video minutes:', error);
        res.status(500).json({ error: 'فشل في خصم الرصيد' });
    }
});

/**
 * POST /api/credits/consume-article
 * Consume article access credits
 */
router.post('/consume-article', authenticateUser, async (req, res) => {
    try {
        const { article_id } = req.body;
        const userId = req.user.id;

        if (!article_id) {
            return res.status(400).json({ error: 'معرف المقال مطلوب' });
        }

        const { data, error } = await supabase
            .rpc('consume_article_credit', {
                p_user_id: userId,
                p_article_id: article_id
            });

        if (error) throw error;

        if (!data.success) {
            return res.status(400).json({ error: data.message });
        }

        res.json({
            success: true,
            message: 'تم فتح المقال بنجاح',
            remaining_credits: data.remaining_credits,
            remaining_balance: data.remaining_balance
        });
    } catch (error) {
        console.error('Error consuming article credit:', error);
        res.status(500).json({ error: 'فشل في خصم الرصيد' });
    }
});

/**
 * GET /api/credits/check-article-access/:articleId
 * Check if user has access to a specific article
 */
router.get('/check-article-access/:articleId', optionalAuth, async (req, res) => {
    try {
        const { articleId } = req.params;

        // Check if article requires credits
        const { data: article } = await supabase
            .from('articles')
            .select('credits_required')
            .eq('id', articleId)
            .single();

        if (!article) {
            return res.status(404).json({ error: 'المقال غير موجود' });
        }

        // If user is not logged in, return requirement
        if (!req.user) {
            return res.json({
                has_access: false,
                requires_auth: true,
                credits_required: article.credits_required
            });
        }

        const userId = req.user.id;

        if (article.credits_required === 0) {
            return res.json({ has_access: true, free: true, credits_required: 0 });
        }

        // Check if user has access
        const { data: access } = await supabase
            .from('article_access')
            .select('id')
            .eq('user_id', userId)
            .eq('article_id', articleId)
            .single();

        res.json({
            has_access: !!access,
            credits_required: article.credits_required
        });
    } catch (error) {
        console.error('Error checking article access:', error);
        res.status(500).json({ error: 'فشل في التحقق من الصلاحية' });
    }
});

/**
 * GET /api/credits/transactions
 * Get transaction history
 */
router.get('/transactions', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, type } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('credit_transactions')
            .select('*', { count: 'exact' })
            .eq('custom_user_id', userId)
            .order('transaction_date', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (type) {
            query = query.eq('transaction_type', type);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            data,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'فشل في جلب السجل' });
    }
});

export default router;
