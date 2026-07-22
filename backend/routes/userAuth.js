import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'crypto';
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
import { trackLoginAttempt, checkLoginAllowed } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { validatePasswordStrength } from '../config/security.js';
import { validateFileSignature } from '../utils/fileValidation.js';
import logger from '../config/logger.js';
import { supabasePublic as supabase, supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

const SALT_ROUNDS = 12;

/**
 * Cookie options for the `user_session` httpOnly cookie.
 * SameSite=Strict is the primary CSRF mitigation.
 * Secure=true is enforced in production only (allows local http dev).
 */
const USER_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — matches JWT_EXPIRES_IN
    path: '/',
};


/**
 * Normalizes phone numbers for consistency
 */
const normalizePhoneNumber = (phone) => {
    if (!phone) return null;
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    // Normalize Arabic-Indic digits (U+0660–U+0669) to Western Arabic digits
    // using Unicode arithmetic rather than a string-index lookup — robust to
    // any whitespace or encoding artefacts in a string literal.
    cleaned = cleaned.replace(/[\u0660-\u0669]/g, d => d.codePointAt(0) - 0x0660);
    return cleaned;
};

// (REMOVED local isValidPassword, using centralized version from config/security.js)

/**
 * POST /api/auth/register
 * Register a new user with phone + password
 */
router.post('/register', authLimiter, validate(schemas.register), asyncHandler(async (req, res) => {
    try {
        const { phone_number, password, display_name } = req.body;

        const normalizedPhone = normalizePhoneNumber(phone_number);

        // Check if phone already exists (admin client bypasses RLS)
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('phone_number', normalizedPhone)
            .single();

        if (existingUser) {
            return res.status(409).json({
                error: 'رقم الهاتف مسجل مسبقاً',
                code: 'PHONE_EXISTS'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user (admin client needed — no session exists yet so anon/public RLS would block insert)
        const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert({
                phone_number: normalizedPhone,
                password_hash: passwordHash,
                display_name: display_name || null
            })
            .select('id, phone_number, display_name, created_at')
            .single();

        if (createError) {
            logger.error('Error creating user:', createError);

            // Check if it's a unique violation (phone number already exists)
            if (createError.code === '23505') { // PostgreSQL unique violation code
                return res.status(409).json({
                    error: 'رقم الهاتف مسجل مسبقاً',
                    code: 'PHONE_EXISTS'
                });
            }

            return res.status(500).json({
                error: 'فشل إنشاء الحساب',
                code: 'CREATE_FAILED'
            });
        }

        if (!newUser || !newUser.id) {
            logger.error('User creation returned no data');
            return res.status(500).json({
                error: 'فشل إنشاء الحساب',
                code: 'CREATE_FAILED'
            });
        }

        // Verify the user actually exists in the database before proceeding
        const { data: verifyUser, error: verifyError } = await supabase
            .from('users')
            .select('id')
            .eq('id', newUser.id)
            .single();

        if (verifyError || !verifyUser) {
            logger.error('User verification failed after insert:', verifyError);
            return res.status(500).json({
                error: 'فشل إنشاء الحساب',
                code: 'CREATE_FAILED'
            });
        }

        try {
            // Initialize user credits (custom_user_id only, user_id is for auth.users)
            const { error: creditsError } = await supabaseAdmin
                .from('user_credits')
                .insert({
                    custom_user_id: newUser.id,
                    balance: 0,
                    total_earned: 0,
                    total_spent: 0,
                    video_watch_minutes: 0,
                    article_credits: 0
                });

            if (creditsError) {
                logger.error('Error creating user credits (non-fatal):', creditsError);
                // Non-fatal: user can still use the app, credits will be created on first use
            }
        } catch (creditsError) {
            logger.error('Exception creating user credits (non-fatal):', creditsError);
            // Still allow registration to succeed even if credits creation fails
        }

        // Generate token and create session
        const token = generateToken(newUser.id);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.socket?.remoteAddress;

        try {
            await createSession(newUser.id, token, deviceInfo, ipAddress);
        } catch (sessionError) {
            logger.error('Error creating session:', sessionError);

            // Compensating transaction: attempt to remove both records independently
            // so a failure in one does not silently skip the other.
            // Any failure is logged with a [RECONCILE] prefix for manual ops cleanup.
            let creditsCleanedUp = false;
            let userCleanedUp = false;
            try {
                const { error: creditDelErr } = await supabaseAdmin
                    .from('user_credits')
                    .delete()
                    .eq('custom_user_id', newUser.id);
                if (creditDelErr) throw creditDelErr;
                creditsCleanedUp = true;
            } catch (creditCleanupErr) {
                logger.error(`[RECONCILE] Failed to delete user_credits for zombie user ${newUser.id}:`, creditCleanupErr);
            }
            try {
                const { error: userDelErr } = await supabaseAdmin
                    .from('users')
                    .delete()
                    .eq('id', newUser.id);
                if (userDelErr) throw userDelErr;
                userCleanedUp = true;
            } catch (userCleanupErr) {
                logger.error(`[RECONCILE] Failed to delete zombie user ${newUser.id}:`, userCleanupErr);
            }
            if (creditsCleanedUp && userCleanedUp) {
                logger.info(`Compensating transaction successful for user ${newUser.id}`);
            } else {
                logger.error(
                    `[RECONCILE] Partial cleanup for user ${newUser.id}: ` +
                    `credits=${creditsCleanedUp}, user=${userCleanedUp}. Manual intervention may be required.`
                );
            }

            // If session creation fails, we should return an error
            return res.status(500).json({
                error: 'فشل إنشاء الجلسة و تم الغاء تسجيل الحساب',
                code: 'SESSION_CREATE_FAILED'
            });
        }

        res.status(201).cookie('user_session', token, USER_COOKIE_OPTIONS).json({
            success: true,
            message: 'تم إنشاء الحساب بنجاح',
            user: {
                id: newUser.id,
                phone_number: newUser.phone_number,
                display_name: newUser.display_name
            }
        });

    } catch (error) {
        logger.error('Registration error:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        throw new AppError('حدث خطأ أثناء التسجيل', 500, 'SERVER_ERROR');
    }
}));

/**
 * POST /api/auth/login
 * Login with phone + password
 */
router.post('/login', authLimiter, checkLoginAllowed, validate(schemas.login), asyncHandler(async (req, res) => {
    try {
        const { phone_number, password } = req.body;

        const normalizedPhone = normalizePhoneNumber(phone_number);

        // Find user
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, phone_number, password_hash, display_name, is_active')
            .eq('phone_number', normalizedPhone)
            .single();

        if (findError || !user) {
            const attemptResult = await trackLoginAttempt(normalizedPhone, false, req.ip);
            if (attemptResult.serviceUnavailable) {
                return res.status(503).json({
                    error: 'خدمة المصادقة غير متاحة مؤقتاً. حاول مرة أخرى قريباً',
                    code: 'SERVICE_UNAVAILABLE'
                });
            }
            return res.status(401).json({
                error: 'رقم الهاتف أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS',
                remainingAttempts: attemptResult.remainingAttempts
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                error: 'تم تعطيل الحساب. تواصل مع الدعم',
                code: 'ACCOUNT_DISABLED'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            const attemptResult = await trackLoginAttempt(normalizedPhone, false, req.ip);
            if (attemptResult.serviceUnavailable) {
                return res.status(503).json({
                    error: 'خدمة المصادقة غير متاحة مؤقتاً. حاول مرة أخرى قريباً',
                    code: 'SERVICE_UNAVAILABLE'
                });
            }
            return res.status(401).json({
                error: 'رقم الهاتف أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS',
                remainingAttempts: attemptResult.remainingAttempts
            });
        }

        // Successful login
        await trackLoginAttempt(normalizedPhone, true, req.ip);

        // Generate token and create session
        const token = generateToken(user.id);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.socket?.remoteAddress;

        await createSession(user.id, token, deviceInfo, ipAddress);

        // Update last login using admin client — the user session isn't established
        // server-side at this point so the public client's write may fail silently
        // if RLS requires an authenticated context (L5 fix).
        await supabaseAdmin
            .from('users')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', user.id);

        res.cookie('user_session', token, USER_COOKIE_OPTIONS).json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            user: {
                id: user.id,
                phone_number: user.phone_number,
                display_name: user.display_name
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        throw new AppError('حدث خطأ أثناء تسجيل الدخول', 500, 'SERVER_ERROR');
    }
}));

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticateUser, asyncHandler(async (req, res) => {
    try {
        await invalidateSession(req.sessionId);

        res.clearCookie('user_session', { path: '/' }).json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
    } catch (error) {
        logger.error('Logout error:', error);
        throw new AppError('حدث خطأ أثناء تسجيل الخروج', 500, 'SERVER_ERROR');
    }
}));

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticateUser, asyncHandler(async (req, res) => {
    try {
        await invalidateAllUserSessions(req.user.id);

        res.clearCookie('user_session', { path: '/' }).json({
            success: true,
            message: 'تم تسجيل الخروج من جميع الأجهزة'
        });
    } catch (error) {
        logger.error('Logout all error:', error);
        throw new AppError('حدث خطأ', 500, 'SERVER_ERROR');
    }
}));

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', authenticateUser, asyncHandler(async (req, res) => {
    try {
        // Get user with credits
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
            total_spent: 0
        };

        // Fetch typed credits with type names
        const { data: typedCredits } = await supabase
            .from('user_typed_credits')
            .select('credit_type_id, balance, credit_types(name, prefix)')
            .eq('user_id', req.user.id)
            .gt('balance', 0);

        const typed_credits = (typedCredits || []).map(tc => ({
            credit_type_id: tc.credit_type_id,
            name: tc.credit_types?.name || 'Unknown',
            prefix: tc.credit_types?.prefix || '',
            balance: tc.balance
        }));

        res.json({
            user: {
                id: req.user.id,
                phone_number: req.user.phoneNumber,
                display_name: req.user.displayName,
                created_at: req.user.createdAt,
                role: req.user.role,
                verification_status: req.user.verificationStatus
            },
            credits: {
                ...credits,
                typed_credits
            }
        });
    } catch (error) {
        logger.error('Profile error:', error);
        throw new AppError('حدث خطأ', 500, 'SERVER_ERROR');
    }
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticateUser, validate(schemas.updateProfile), asyncHandler(async (req, res) => {
    try {
        const { display_name } = req.body;

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                display_name,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id)
            .select('id, phone_number, display_name')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'تم تحديث الملف الشخصي',
            user: updatedUser
        });
    } catch (error) {
        logger.error('Update profile error:', error);
        throw new AppError('حدث خطأ أثناء التحديث', 500, 'SERVER_ERROR');
    }
}));

/**
 * PUT /api/auth/change-password
 * Change password
 */
router.put('/change-password', authenticateUser, asyncHandler(async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                error: 'كلمة المرور الحالية والجديدة مطلوبتان',
                code: 'MISSING_FIELDS'
            });
        }

        const pwdValidation = validatePasswordStrength(new_password);
        if (!pwdValidation.valid) {
            return res.status(400).json({
                error: pwdValidation.errors.join(', '),
                code: 'WEAK_PASSWORD'
            });
        }

        // Get current password hash
        const { data: user } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', req.user.id)
            .single();

        // Verify current password
        const isValid = await bcrypt.compare(current_password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({
                error: 'كلمة المرور الحالية غير صحيحة',
                code: 'INVALID_PASSWORD'
            });
        }

        // Hash and update new password
        const newPasswordHash = await bcrypt.hash(new_password, SALT_ROUNDS);

        await supabase
            .from('users')
            .update({
                password_hash: newPasswordHash,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id);

        // Invalidate all other sessions
        await invalidateAllUserSessions(req.user.id);

        // Create new session — pass device/IP to preserve the session audit trail.
        const token = generateToken(req.user.id);
        const newDeviceInfo = req.headers['user-agent'] || null;
        const newIpAddress = req.ip || req.socket?.remoteAddress || null;
        await createSession(req.user.id, token, newDeviceInfo, newIpAddress);

        // Issue a fresh cookie with the new token
        res.cookie('user_session', token, USER_COOKIE_OPTIONS).json({
            success: true,
            message: 'تم تغيير كلمة المرور بنجاح'
        });
    } catch (error) {
        logger.error('Change password error:', error);
        throw new AppError('حدث خطأ أثناء تغيير كلمة المرور', 500, 'SERVER_ERROR');
    }
}));


const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * POST /api/auth/register-doctor
 * Register a new doctor with extra verification details and syndicate card image
 */
router.post('/register-doctor', authLimiter, upload.single('syndicate_card'), validate(schemas.registerDoctor), asyncHandler(async (req, res) => {
    let uploadedPath = null;
    try {
        const {
            phone_number,
            password,
            display_name,
            specialization,
            bio,
            education,
            experience_years,
            clinic_address,
            email,
            website
        } = req.body;

        // 1. Text validations
        if (!phone_number || !password || !display_name || !specialization || !bio || !education || !clinic_address) {
            return res.status(400).json({
                error: 'جميع الحقول الأساسية مطلوبة للتحقق من حساب الطبيب',
                code: 'MISSING_FIELDS'
            });
        }

        const normalizedPhone = normalizePhoneNumber(phone_number);
        if (!/^09\d{8}$/.test(normalizedPhone)) {
            return res.status(400).json({
                error: 'رقم الهاتف يجب أن يكون بالصيغة 09xxxxxxxx',
                code: 'INVALID_PHONE'
            });
        }

        const pwdValidation = validatePasswordStrength(password);
        if (!pwdValidation.valid) {
            return res.status(400).json({
                error: pwdValidation.errors.join(', '),
                code: 'WEAK_PASSWORD'
            });
        }

        // 2. Validate syndicate card file presence & type (magic bytes)
        if (!req.file) {
            return res.status(400).json({
                error: 'يرجى تحميل صورة بطاقة النقابة أو الهوية المهنية لتوثيق الحساب',
                code: 'MISSING_CARD_FILE'
            });
        }

        const signature = await validateFileSignature(req.file.buffer, [
            'image/jpeg', 'image/png', 'image/webp'
        ]);

        if (!signature.valid) {
            return res.status(400).json({
                error: 'صيغة الملف غير مدعومة. يرجى رفع صورة بصيغة JPEG أو PNG أو WebP فقط',
                code: 'INVALID_FILE_SIGNATURE'
            });
        }

        // 3. Check duplicate phone in database
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('phone_number', normalizedPhone)
            .single();

        if (existingUser) {
            return res.status(409).json({
                error: 'رقم الهاتف مسجل مسبقاً',
                code: 'PHONE_EXISTS'
            });
        }

        // 4. Check display name uniqueness in authors table (case-insensitive)
        const { data: existingAuthor } = await supabaseAdmin
            .from('authors')
            .select('id')
            .ilike('name', display_name.trim())
            .maybeSingle();

        if (existingAuthor) {
            return res.status(409).json({
                error: 'اسم الطبيب مسجل بالفعل كاسم مؤلف في المنصة. يرجى اختيار اسم مهني مختلف قليلاً',
                code: 'AUTHOR_NAME_EXISTS'
            });
        }

        // 5. Generate UUID beforehand to link storage path and insert transaction
        const userId = crypto.randomUUID();

        // 6. Upload file to private syndicate-cards bucket
        const fileExt = path.extname(req.file.originalname) || `.${signature.ext}`;
        const filename = `${userId}-${Date.now()}${fileExt}`;
        uploadedPath = filename;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('syndicate-cards')
            .upload(filename, req.file.buffer, {
                contentType: signature.mime,
                upsert: false
            });

        if (uploadError) {
            logger.error('Error uploading syndicate card:', uploadError);
            return res.status(500).json({
                error: 'فشل تحميل صورة الهوية المهنية',
                code: 'UPLOAD_FAILED'
            });
        }

        // 7. Hash Password & Insert User into database
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                phone_number: normalizedPhone,
                password_hash: passwordHash,
                display_name: display_name.trim(),
                role: 'doctor',
                verification_status: 'pending',
                syndicate_card_url: filename,
                specialization: specialization.trim(),
                bio: bio.trim(),
                education: education.trim(),
                experience_years: parseInt(experience_years) || 1,
                clinic_address: clinic_address.trim(),
                email: email ? email.trim() : null,
                website: website ? website.trim() : null
            })
            .select('id, phone_number, display_name, role, verification_status')
            .single();

        if (createError) {
            logger.error('Error creating doctor user:', createError);

            // COMPENSATING TRANSACTION: Delete uploaded file from storage
            await supabaseAdmin.storage
                .from('syndicate-cards')
                .remove([filename]);

            return res.status(500).json({
                error: 'فشل تسجيل حساب الطبيب',
                code: 'CREATE_FAILED'
            });
        }

        // Initialize credits
        try {
            await supabaseAdmin
                .from('user_credits')
                .insert({
                    custom_user_id: newUser.id,
                    balance: 0,
                    total_earned: 0,
                    total_spent: 0,
                    video_watch_minutes: 0,
                    article_credits: 0
                });
        } catch (creditsError) {
            logger.error('Error creating user credits for doctor (non-fatal):', creditsError);
        }

        // Generate token and session
        const token = generateToken(newUser.id);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.socket?.remoteAddress;

        try {
            await createSession(newUser.id, token, deviceInfo, ipAddress);
        } catch (sessionError) {
            logger.error('Error creating doctor session:', sessionError);

            // COMPENSATING TRANSACTION: Delete user and file
            await supabaseAdmin.from('user_credits').delete().eq('custom_user_id', newUser.id);
            await supabaseAdmin.from('users').delete().eq('id', newUser.id);
            await supabaseAdmin.storage.from('syndicate-cards').remove([filename]);

            return res.status(500).json({
                error: 'فشل إنشاء جلسة تسجيل الدخول و تم إلغاء الحساب',
                code: 'SESSION_CREATE_FAILED'
            });
        }

        res.status(201).cookie('user_session', token, USER_COOKIE_OPTIONS).json({
            success: true,
            message: 'تم تسجيل الحساب بنجاح وطلب التحقق قيد المراجعة',
            user: {
                id: newUser.id,
                phone_number: newUser.phone_number,
                display_name: newUser.display_name,
                role: newUser.role,
                verification_status: newUser.verification_status
            }
        });

    } catch (error) {
        logger.error('Doctor registration error:', error);

        // COMPENSATING TRANSACTION: Delete uploaded file if path exists
        if (uploadedPath) {
            try {
                await supabaseAdmin.storage
                    .from('syndicate-cards')
                    .remove([uploadedPath]);
            } catch (cleanupError) {
                logger.error('Error during exception file cleanup:', cleanupError);
            }
        }

        throw new AppError('حدث خطأ أثناء تسجيل حساب الطبيب', 500, 'SERVER_ERROR');
    }
}));

export default router;
