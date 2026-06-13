import express from 'express';
import { authenticateUser, optionalAuth } from '../middleware/userAuth.js';
import { redeemLimiter, accountRedeemLimiter, consumeLimiter } from '../middleware/rateLimiter.js';
import { validateRedeem, validate, schemas } from '../middleware/validation.js';
import { supabaseAdmin as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    getCreditBalance,
    redeemLicenseCode,
    consumeVideoMinutes,
    consumeArticleCredit,
    checkArticleAccess,
    consumeResearchCredit,
    checkResearchAccess,
    getTransactions
} from '../services/credits/creditsService.js';

const router = express.Router();

/**
 * GET /api/credits/balance
 * Get user's complete credit balance (requires authentication)
 */
router.get('/balance', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const balance = await getCreditBalance(supabase, userId);
    res.json(balance);
}));

/**
 * POST /api/credits/redeem
 * Redeem a license code (supports video, article, universal, or both types)
 */
router.post('/redeem', authenticateUser, redeemLimiter, accountRedeemLimiter, validateRedeem, asyncHandler(async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;

    const metadata = {
        ip: req.ip || req.headers['x-forwarded-for']?.split(',')[0],
        user_agent: req.headers['user-agent']
    };

    const result = await redeemLicenseCode(supabase, { code, userId, metadata });
    res.json(result);
}));

/**
 * POST /api/credits/consume-video
 * Consume video watch time credits
 * Fix #9 — consumeLimiter applied to prevent runaway billing loops
 */
router.post('/consume-video', authenticateUser, consumeLimiter, validate(schemas.creditsConsumeVideo), asyncHandler(async (req, res) => {
    const { minutes, course_id } = req.body;
    const userId = req.user.id;

    const result = await consumeVideoMinutes(supabase, {
        userId,
        minutes,
        courseId: course_id
    });

    res.json(result);
}));

/**
 * POST /api/credits/consume-article
 * Consume article access credits
 * Fix #9 — consumeLimiter applied
 */
router.post('/consume-article', authenticateUser, consumeLimiter, validate(schemas.creditsConsumeArticle), asyncHandler(async (req, res) => {
    const { article_id } = req.body;
    const userId = req.user.id;

    const result = await consumeArticleCredit(supabase, { userId, articleId: article_id });
    res.json(result);
}));

/**
 * GET /api/credits/check-article-access/:articleId
 * Check if user has access to a specific article
 * Fix #11 — isAdmin is derived from req.user set by optionalAuth; no extra DB query in service
 * Fix #12 — uses the dedicated creditsCheckArticleAccess schema
 */
router.get('/check-article-access/:articleId', optionalAuth, validate(schemas.creditsCheckArticleAccess), asyncHandler(async (req, res) => {
    const { articleId } = req.params;
    const userId = req.user?.id || null;
    const isAdmin = req.user?.is_admin === true;
    const result = await checkArticleAccess(supabase, { articleId, userId, isAdmin });
    res.json(result);
}));

/**
 * POST /api/credits/consume-research
 * Consume research access credits
 * Fix #9 — consumeLimiter applied
 */
router.post('/consume-research', authenticateUser, consumeLimiter, validate(schemas.creditsConsumeResearch), asyncHandler(async (req, res) => {
    const { research_id } = req.body;
    const userId = req.user.id;

    const result = await consumeResearchCredit(supabase, { userId, researchId: research_id });
    res.json(result);
}));

/**
 * GET /api/credits/check-research-access/:researchId
 * Check if user has access to a specific research paper
 * Fix #11 — isAdmin from middleware, no extra DB query
 * Fix #12 — uses the dedicated creditsCheckResearchAccess schema
 */
router.get('/check-research-access/:researchId', optionalAuth, validate(schemas.creditsCheckResearchAccess), asyncHandler(async (req, res) => {
    const { researchId } = req.params;
    const userId = req.user?.id || null;
    const isAdmin = req.user?.is_admin === true;
    const result = await checkResearchAccess(supabase, { researchId, userId, isAdmin });
    res.json(result);
}));

/**
 * GET /api/credits/transactions
 * Get transaction history
 */
router.get('/transactions', authenticateUser, validate(schemas.creditsTransactions), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, type } = req.query;
    const result = await getTransactions(supabase, { userId, page, limit, type });
    res.json(result);
}));

export default router;
