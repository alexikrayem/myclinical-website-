import express from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken, trackLoginAttempt, checkLoginAllowed } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { ADMIN_SELECT } from '../../utils/queryFields.js';
import logger from '../../config/logger.js';

const router = express.Router();

// Admin login
router.post('/login',
    authLimiter,
    checkLoginAllowed,
    [
        body('email').isEmail().withMessage('بريد إلكتروني غير صالح').normalizeEmail(),
        body('password').isLength({ min: 6 }).withMessage('كلمة المرور قصيرة جداً')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: errors.array()[0].msg,
                code: 'VALIDATION_ERROR'
            });
        }

        const { email, password } = req.body;

        // Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            const attemptResult = await trackLoginAttempt(email, false);
            logger.error('Admin Auth error:', authError.message);
            return res.status(401).json({
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS',
                remainingAttempts: attemptResult.remainingAttempts
            });
        }

        if (!authData.user) {
            await trackLoginAttempt(email, false);
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED'
            });
        }

        // Check if the user is an admin
        const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select(ADMIN_SELECT)
            .eq('id', authData.user.id)
            .single();

        if (adminError || !adminData) {
            await trackLoginAttempt(email, false);
            logger.error('Admin check error:', adminError);
            return res.status(403).json({
                error: 'Access denied - insufficient permissions',
                code: 'NOT_ADMIN'
            });
        }

        // Successful login
        await trackLoginAttempt(email, true);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        };

        res
            .cookie('session', authData.session.access_token, cookieOptions)
            .json({
                message: 'Login successful',
                user: {
                    id: adminData.id,
                    email: adminData.email,
                    role: adminData.role,
                },
                session: {
                    access_token: authData.session.access_token,
                    expires_at: authData.session.expires_at,
                },
            });
    }));

// Logout
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    res.clearCookie('session');
    res.json({
        message: 'Logout successful',
        code: 'LOGOUT_SUCCESS'
    });
}));

// Profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
    const { data: adminData, error } = await supabase
        .from('admins')
        .select('id, email, role, created_at')
        .eq('id', req.user.id)
        .single();

    if (error) {
        logger.error('Error fetching admin profile:', error);
        throw new AppError('Failed to fetch admin profile', 500, 'ADMIN_PROFILE_FAILED');
    }

    res.json(adminData);
}));

export default router;
