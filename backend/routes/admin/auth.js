import express from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase, supabasePublic } from '../../config/supabase.js';
import { authenticateToken, trackLoginAttempt, checkLoginAllowed, revokeTokenCache } from '../../middleware/auth.js';
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

        // Sign in with Supabase Auth using the public (anon) client.
        // The service role key is NOT needed for credential validation and should
        // not be used here to limit blast radius if the auth endpoint is abused.
        const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            const attemptResult = await trackLoginAttempt(email, false, req.ip);
            if (attemptResult.serviceUnavailable) {
                logger.error('Admin Auth error:', authError.message);
                return res.status(503).json({
                    error: 'Authentication service temporarily unavailable. Please try again shortly.',
                    code: 'SERVICE_UNAVAILABLE'
                });
            }
            logger.error('Admin Auth error:', authError.message);
            return res.status(401).json({
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS',
                remainingAttempts: attemptResult.remainingAttempts
            });
        }

        if (!authData.user) {
            const attemptResult = await trackLoginAttempt(email, false, req.ip);
            if (attemptResult.serviceUnavailable) {
                return res.status(503).json({
                    error: 'Authentication service temporarily unavailable. Please try again shortly.',
                    code: 'SERVICE_UNAVAILABLE'
                });
            }
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
            await trackLoginAttempt(email, false, req.ip);
            logger.error('Admin check error:', adminError);
            return res.status(403).json({
                error: 'Access denied - insufficient permissions',
                code: 'NOT_ADMIN'
            });
        }

        // Successful login
        await trackLoginAttempt(email, true, req.ip);

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
                    expires_at: authData.session.expires_at,
                },
            });
    }));

// Logout
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    // 1. Revoke Supabase session so the token is invalidated at the provider level.
    //    We use signOut with the user's ID to invalidate all sessions for this admin,
    //    which is appropriate since admin tokens have elevated privileges.
    try {
        await supabase.auth.admin.signOut(req.user.id);
    } catch (signOutErr) {
        // Log but don't block the logout — we still clear local state below.
        logger.error('Admin Supabase signOut error:', signOutErr);
    }

    // 2. Purge the Redis cached auth entry for this specific token so the 60-second
    //    cache window is closed immediately (resolves the open TODO in auth.js).
    const rawToken = req.cookies?.session || req.headers['authorization']?.split(' ')[1];
    await revokeTokenCache(rawToken);

    // 3. Clear the session cookie.
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
