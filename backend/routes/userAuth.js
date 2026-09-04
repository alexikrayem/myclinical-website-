/**
 * userAuth.js (routes)
 *
 * Social-only authentication via Meta (Facebook + Instagram OAuth2).
 * All legacy phone+password endpoints have been replaced.
 *
 * Remaining endpoints:
 *   POST /api/auth/social/callback      — OAuth code exchange + login/register
 *   GET  /api/auth/social/config        — Public OAuth config for frontend
 *   POST /api/auth/logout               — Invalidate current session
 *   POST /api/auth/logout-all           — Invalidate all sessions
 *   GET  /api/auth/profile              — Get current user profile
 *   PUT  /api/auth/profile              — Update display_name / specialty
 *   POST /api/auth/verify               — Submit verification documents
 *   GET  /api/auth/verification-status  — Get latest submission status
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import {
    authenticateUser,
    generateToken,
    createSession,
    invalidateSession,
    invalidateAllUserSessions
} from '../middleware/userAuth.js';
import { validate, schemas } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { validateFileSignature } from '../utils/fileValidation.js';
import logger from '../config/logger.js';
import { supabasePublic as supabase, supabaseAdmin } from '../config/supabase.js';
import {
    exchangeCodeForToken,
    fetchUserProfile,
    FACEBOOK_APP_ID_PUBLIC,
    FACEBOOK_REDIRECT_URI_PUBLIC,
    PROVIDER_SCOPES,
} from '../config/facebook.js';

const router = express.Router();

const USER_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
};

// Multer for document uploads — 10 MB per file, held in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
const verificationUpload = upload.fields([
    { name: 'personal_id', maxCount: 1 },
    { name: 'medical_id', maxCount: 1 },
    { name: 'practice_license', maxCount: 1 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/social/config
// Returns the public Facebook App ID and redirect URI so the frontend can build
// the OAuth authorization URL client-side without exposing the App Secret.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/social/config', (req, res) => {
    res.json({
        appId: FACEBOOK_APP_ID_PUBLIC,
        redirectUri: FACEBOOK_REDIRECT_URI_PUBLIC,
        scopes: PROVIDER_SCOPES,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/social/callback
// Body: { provider: 'facebook'|'instagram', code: string, specialty?: string }
//
// Flow:
//  1. Exchange code for access token via Meta Graph API
//  2. Fetch user profile from Graph API
//  3. Look up existing user by (provider, provider_id)
//     a. Existing user → create session → set cookie → return
//     b. New user      → validate specialty → create user → create credits → create session
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/social/callback',
    authLimiter,
    validate(schemas.socialCallback),
    asyncHandler(async (req, res) => {
        const { provider, code, specialty } = req.body;

        // 1. Exchange code for access token (server-side — App Secret stays private)
        let accessToken;
        try {
            accessToken = await exchangeCodeForToken(code);
        } catch (err) {
            logger.warn(`OAuth code exchange failed for provider=${provider}: ${err.message}`);
            return res.status(401).json({
                error: 'فشل التحقق من رمز الدخول الاجتماعي. يرجى المحاولة مرة أخرى',
                code: 'OAUTH_CODE_INVALID',
            });
        }

        // 2. Fetch profile from Meta Graph API
        let profile;
        try {
            profile = await fetchUserProfile(accessToken, provider);
        } catch (err) {
            logger.warn(`Profile fetch failed for provider=${provider}: ${err.message}`);
            return res.status(401).json({
                error: 'تعذّر جلب بيانات الملف الشخصي من المنصة الاجتماعية',
                code: 'PROFILE_FETCH_FAILED',
            });
        }

        const { id: providerId, name, username, profileUrl, avatarUrl } = profile;

        // 3. Look up by social identity
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id, display_name, is_active, is_verified, specialty, social_provider, social_username')
            .eq('social_provider', provider)
            .eq('social_provider_id', providerId)
            .maybeSingle();

        let userId;

        if (existingUser) {
            // ── 3a. Returning user ───────────────────────────────────────────
            if (!existingUser.is_active) {
                return res.status(403).json({
                    error: 'تم تعطيل الحساب. تواصل مع الدعم',
                    code: 'ACCOUNT_DISABLED',
                });
            }

            // Keep avatar/username fresh on every login, non-blocking
            supabaseAdmin
                .from('users')
                .update({
                    social_avatar_url: avatarUrl || existingUser.social_avatar_url,
                    social_username: username || existingUser.social_username,
                    social_profile_url: profileUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingUser.id)
                .then(() => { })
                .catch((e) => logger.error('Non-fatal: failed to refresh social profile:', e));

            userId = existingUser.id;
        } else {
            // ── 3b. New user ─────────────────────────────────────────────────
            if (!specialty || !specialty.trim()) {
                return res.status(400).json({
                    error: 'يرجى اختيار التخصص الطبي لإتمام إنشاء الحساب',
                    code: 'SPECIALTY_REQUIRED',
                });
            }

            const { data: newUser, error: createError } = await supabaseAdmin
                .from('users')
                .insert({
                    display_name: name,
                    social_provider: provider,
                    social_provider_id: providerId,
                    social_username: username,
                    social_profile_url: profileUrl,
                    social_avatar_url: avatarUrl,
                    specialty: specialty.trim(),
                    is_verified: false,
                })
                .select('id')
                .single();

            if (createError) {
                // Handle race condition where two requests register the same social account
                if (createError.code === '23505') {
                    return res.status(409).json({
                        error: 'هذا الحساب الاجتماعي مسجل بالفعل',
                        code: 'SOCIAL_ACCOUNT_EXISTS',
                    });
                }
                logger.error('User creation error:', createError);
                throw new AppError('فشل إنشاء الحساب', 500, 'CREATE_FAILED');
            }

            userId = newUser.id;

            // Initialize credits (non-fatal)
            supabaseAdmin
                .from('user_credits')
                .insert({
                    custom_user_id: userId,
                    balance: 0,
                    total_earned: 0,
                    total_spent: 0,
                    video_watch_minutes: 0,
                    article_credits: 0,
                })
                .then(() => { })
                .catch((e) => logger.error('Non-fatal: failed to create user_credits:', e));
        }

        // 4. Create session and set httpOnly cookie
        const token = generateToken(userId);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.socket?.remoteAddress;

        try {
            await createSession(userId, token, deviceInfo, ipAddress);
        } catch (sessionErr) {
            logger.error('Session creation failed after OAuth:', sessionErr);
            // If new user, compensate
            if (!existingUser) {
                await supabaseAdmin.from('user_credits').delete().eq('custom_user_id', userId).catch(() => { });
                await supabaseAdmin.from('users').delete().eq('id', userId).catch(() => { });
            }
            throw new AppError('فشل إنشاء الجلسة', 500, 'SESSION_CREATE_FAILED');
        }

        // 5. Fetch full user row for response
        const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('id, display_name, social_provider, social_username, social_avatar_url, specialty, is_verified, verification_status')
            .eq('id', userId)
            .single();

        const isNewUser = !existingUser;

        res
            .status(isNewUser ? 201 : 200)
            .cookie('user_session', token, USER_COOKIE_OPTIONS)
            .json({
                success: true,
                isNewUser,
                user: {
                    id: userRow.id,
                    display_name: userRow.display_name,
                    social_provider: userRow.social_provider,
                    social_username: userRow.social_username,
                    social_avatar_url: userRow.social_avatar_url,
                    specialty: userRow.specialty,
                    is_verified: userRow.is_verified,
                    verification_status: userRow.verification_status || 'none',
                },
            });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', authenticateUser, asyncHandler(async (req, res) => {
    try {
        await invalidateSession(req.sessionId);
        res.clearCookie('user_session', { path: '/' }).json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح',
        });
    } catch (error) {
        logger.error('Logout error:', error);
        throw new AppError('حدث خطأ أثناء تسجيل الخروج', 500, 'SERVER_ERROR');
    }
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout-all
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout-all', authenticateUser, asyncHandler(async (req, res) => {
    try {
        await invalidateAllUserSessions(req.user.id);
        res.clearCookie('user_session', { path: '/' }).json({
            success: true,
            message: 'تم تسجيل الخروج من جميع الأجهزة',
        });
    } catch (error) {
        logger.error('Logout-all error:', error);
        throw new AppError('حدث خطأ', 500, 'SERVER_ERROR');
    }
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', authenticateUser, asyncHandler(async (req, res) => {
    try {
        const { data: creditsData } = await supabase
            .from('user_credits')
            .select('balance, video_watch_minutes, article_credits, research_credits, total_earned, total_spent')
            .eq('custom_user_id', req.user.id)
            .single();

        const credits = creditsData || {
            balance: 0,
            video_watch_minutes: 0,
            article_credits: 0,
            research_credits: 0,
            total_earned: 0,
            total_spent: 0,
        };

        const { data: typedCredits } = await supabase
            .from('user_typed_credits')
            .select('credit_type_id, balance, credit_types(name, prefix)')
            .eq('user_id', req.user.id)
            .gt('balance', 0);

        const typed_credits = (typedCredits || []).map((tc) => ({
            credit_type_id: tc.credit_type_id,
            name: tc.credit_types?.name || 'Unknown',
            prefix: tc.credit_types?.prefix || '',
            balance: tc.balance,
        }));

        res.json({
            user: {
                id: req.user.id,
                display_name: req.user.displayName,
                social_provider: req.user.socialProvider,
                social_username: req.user.socialUsername,
                social_profile_url: req.user.socialProfileUrl,
                social_avatar_url: req.user.socialAvatarUrl,
                specialty: req.user.specialty,
                is_verified: req.user.isVerified,
                verification_status: req.user.verificationStatus,
                role: req.user.role,
                created_at: req.user.createdAt,
            },
            credits: { ...credits, typed_credits },
        });
    } catch (error) {
        logger.error('Profile error:', error);
        throw new AppError('حدث خطأ', 500, 'SERVER_ERROR');
    }
}));

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// Allows updating display_name and specialty.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile', authenticateUser, validate(schemas.updateProfile), asyncHandler(async (req, res) => {
    try {
        const updates = {};
        if (req.body.display_name !== undefined) updates.display_name = req.body.display_name;
        if (req.body.specialty !== undefined) updates.specialty = req.body.specialty;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'لا توجد حقول للتحديث', code: 'NO_FIELDS' });
        }

        updates.updated_at = new Date().toISOString();

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', req.user.id)
            .select('id, display_name, specialty')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'تم تحديث الملف الشخصي',
            user: updatedUser,
        });
    } catch (error) {
        logger.error('Update profile error:', error);
        throw new AppError('حدث خطأ أثناء التحديث', 500, 'SERVER_ERROR');
    }
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify
// Authenticated users submit three documents for professional verification.
// Multipart: personal_id, medical_id, practice_license (all required)
//            + body fields: full_name, specialty, notes?
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/verify',
    authenticateUser,
    verificationUpload,
    validate(schemas.verificationSubmission),
    asyncHandler(async (req, res) => {
        const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

        const files = req.files || {};
        const personalIdFile = files.personal_id?.[0];
        const medicalIdFile = files.medical_id?.[0];
        const practiceFile = files.practice_license?.[0];

        if (!personalIdFile || !medicalIdFile || !practiceFile) {
            return res.status(400).json({
                error: 'يرجى رفع جميع الوثائق المطلوبة: الهوية الشخصية، الهوية المهنية، ورخصة المزاولة',
                code: 'MISSING_FILES',
            });
        }

        // Validate file signatures
        for (const [label, file] of [
            ['الهوية الشخصية', personalIdFile],
            ['الهوية المهنية', medicalIdFile],
            ['رخصة المزاولة', practiceFile],
        ]) {
            const sig = await validateFileSignature(file.buffer, ALLOWED_MIME);
            if (!sig.valid) {
                return res.status(400).json({
                    error: `${label}: صيغة الملف غير مدعومة. يرجى رفع صورة (JPEG/PNG/WebP) أو PDF فقط`,
                    code: 'INVALID_FILE_SIGNATURE',
                });
            }
        }

        // Check for an existing pending submission — prevent duplicate submissions
        const { data: existingPending } = await supabaseAdmin
            .from('verification_submissions')
            .select('id, status')
            .eq('user_id', req.user.id)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingPending) {
            return res.status(409).json({
                error: 'لديك طلب توثيق قيد المراجعة بالفعل. يرجى الانتظار حتى تتم مراجعته',
                code: 'SUBMISSION_PENDING',
            });
        }

        const userId = req.user.id;

        // Upload each document to the private bucket
        const uploadDoc = async (file, label) => {
            const ext = path.extname(file.originalname) || `.${label}`;
            const filename = `${userId}/${label}-${Date.now()}${ext}`;
            const { error: uploadError } = await supabaseAdmin.storage
                .from('verification-documents')
                .upload(filename, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });
            if (uploadError) {
                logger.error(`Error uploading ${label}:`, uploadError);
                throw new AppError(`فشل رفع ${label}`, 500, 'UPLOAD_FAILED');
            }
            return filename;
        };

        let personalIdPath, medicalIdPath, practicePath;
        try {
            [personalIdPath, medicalIdPath, practicePath] = await Promise.all([
                uploadDoc(personalIdFile, 'personal_id'),
                uploadDoc(medicalIdFile, 'medical_id'),
                uploadDoc(practiceFile, 'practice_license'),
            ]);
        } catch (err) {
            // Attempt cleanup of any partially-uploaded files
            [personalIdPath, medicalIdPath, practicePath].filter(Boolean).forEach((p) =>
                supabaseAdmin.storage.from('verification-documents').remove([p]).catch(() => { })
            );
            throw err;
        }

        const { full_name, specialty, notes } = req.body;

        const { data: submission, error: insertError } = await supabaseAdmin
            .from('verification_submissions')
            .insert({
                user_id: userId,
                personal_id_url: personalIdPath,
                medical_id_url: medicalIdPath,
                practice_license_url: practicePath,
                full_name: full_name.trim(),
                specialty: specialty.trim(),
                notes: notes?.trim() || null,
                status: 'pending',
            })
            .select('id, status, created_at')
            .single();

        if (insertError) {
            // Cleanup uploaded files
            await supabaseAdmin.storage
                .from('verification-documents')
                .remove([personalIdPath, medicalIdPath, practicePath])
                .catch(() => { });
            logger.error('Failed to insert verification submission:', insertError);
            throw new AppError('فشل حفظ طلب التوثيق', 500, 'SUBMISSION_FAILED');
        }

        // Update user's verification_status to 'pending' so UI can reflect this
        await supabaseAdmin
            .from('users')
            .update({ verification_status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', userId);

        res.status(201).json({
            success: true,
            message: 'تم استلام طلب التوثيق وهو قيد المراجعة',
            submission: {
                id: submission.id,
                status: submission.status,
                created_at: submission.created_at,
            },
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/verification-status
// Returns the most recent verification submission for the current user.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verification-status', authenticateUser, asyncHandler(async (req, res) => {
    const { data: submission } = await supabaseAdmin
        .from('verification_submissions')
        .select('id, status, rejection_reason, created_at, updated_at')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    res.json({
        is_verified: req.user.isVerified,
        submission: submission || null,
    });
}));

export default router;
