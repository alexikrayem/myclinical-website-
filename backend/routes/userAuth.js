import express from 'express';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
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
import { normalizePhoneNumber } from '../utils/phone.js';
import { supabaseAdmin as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

dotenv.config();

const router = express.Router();

const SALT_ROUNDS = 12;

// Validate password strength
const isValidPassword = (password) => {
    // Minimum 8 characters, at least one letter and one number
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
};

/**
 * POST /api/auth/register
 * Register a new user with phone + password
 */
router.post('/register', validate(schemas.register), asyncHandler(async (req, res) => {
    try {
        const { phone_number, password, display_name } = req.body;

        const normalizedPhone = normalizePhoneNumber(phone_number);

        // Check if phone already exists
        const { data: existingUser } = await supabase
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

        // Create user
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                phone_number: normalizedPhone,
                password_hash: passwordHash,
                display_name: display_name || null
            })
            .select('id, phone_number, display_name, created_at')
            .single();

        if (createError) {
            console.error('Error creating user:', createError);
            
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
            console.error('User creation returned no data');
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
            console.error('User verification failed after insert:', verifyError);
            return res.status(500).json({
                error: 'فشل إنشاء الحساب',
                code: 'CREATE_FAILED'
            });
        }

        try {
            // Initialize user credits (custom_user_id only, user_id is for auth.users)
            const { error: creditsError } = await supabase
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
                console.error('Error creating user credits (non-fatal):', creditsError);
                // Non-fatal: user can still use the app, credits will be created on first use
            }
        } catch (creditsError) {
            console.error('Exception creating user credits (non-fatal):', creditsError);
            // Still allow registration to succeed even if credits creation fails
        }

        // Generate token and create session
        const token = generateToken(newUser.id);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress;

        try {
            await createSession(newUser.id, token, deviceInfo, ipAddress);
        } catch (sessionError) {
            console.error('Error creating session:', sessionError);
            
            // Compensating transaction: remove the user we just created to avoid a zombie account
            try {
                // Delete user_credits first if they were created
                await supabase.from('user_credits').delete().eq('custom_user_id', newUser.id);
                // Delete the user record
                await supabase.from('users').delete().eq('id', newUser.id);
                console.log(`Compensating transaction successful for user ${newUser.id}`);
            } catch (cleanupError) {
                console.error(`Failed to cleanup zombie user ${newUser.id} after session failure:`, cleanupError);
            }

            // If session creation fails, we should return an error
            return res.status(500).json({
                error: 'فشل إنشاء الجلسة و تم الغاء تسجيل الحساب',
                code: 'SESSION_CREATE_FAILED'
            });
        }

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الحساب بنجاح',
            user: {
                id: newUser.id,
                phone_number: newUser.phone_number,
                display_name: newUser.display_name
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        console.error('Error details:', {
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
            .select('*')
            .eq('phone_number', normalizedPhone)
            .single();

        if (findError || !user) {
            const attemptResult = await trackLoginAttempt(normalizedPhone, false);
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
            const attemptResult = await trackLoginAttempt(normalizedPhone, false);
            return res.status(401).json({
                error: 'رقم الهاتف أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS',
                remainingAttempts: attemptResult.remainingAttempts
            });
        }

        // Successful login
        await trackLoginAttempt(normalizedPhone, true);

        // Generate token and create session
        const token = generateToken(user.id);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress;

        await createSession(user.id, token, deviceInfo, ipAddress);

        // Update last login
        await supabase
            .from('users')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', user.id);

        res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            user: {
                id: user.id,
                phone_number: user.phone_number,
                display_name: user.display_name
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
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

        res.json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
    } catch (error) {
        console.error('Logout error:', error);
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

        res.json({
            success: true,
            message: 'تم تسجيل الخروج من جميع الأجهزة'
        });
    } catch (error) {
        console.error('Logout all error:', error);
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
                created_at: req.user.createdAt
            },
            credits: {
                ...credits,
                typed_credits
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        throw new AppError('حدث خطأ', 500, 'SERVER_ERROR');
    }
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticateUser, asyncHandler(async (req, res) => {
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
        console.error('Update profile error:', error);
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

        if (!isValidPassword(new_password)) {
            return res.status(400).json({
                error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم',
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

        // Create new session
        const token = generateToken(req.user.id);
        await createSession(req.user.id, token);

        res.json({
            success: true,
            message: 'تم تغيير كلمة المرور بنجاح',
            token
        });
    } catch (error) {
        console.error('Change password error:', error);
        throw new AppError('حدث خطأ أثناء تغيير كلمة المرور', 500, 'SERVER_ERROR');
    }
}));

export default router;
