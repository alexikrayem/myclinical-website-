import express from 'express';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
    authenticateUser,
    generateToken,
    createSession,
    invalidateSession,
    invalidateAllUserSessions
} from '../middleware/userAuth.js';
import { validate, schemas } from '../middleware/validation.js';

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SALT_ROUNDS = 12;

// Validate phone number format (Syrian/Arabic format)
const isValidPhoneNumber = (phone) => {
    // Remove spaces and dashes
    const cleaned = phone.replace(/[\s-]/g, '');
    // Accept Syrian format: 09xxxxxxxx or +963xxxxxxxxx or 963xxxxxxxxx
    const syrianRegex = /^(\+?963|0)?9\d{8}$/;
    return syrianRegex.test(cleaned);
};

// Normalize phone number to standard format
const normalizePhoneNumber = (phone) => {
    const cleaned = phone.replace(/[\s-]/g, '');
    // Convert all to 09xxxxxxxx format
    if (cleaned.startsWith('+963')) {
        return '0' + cleaned.substring(4);
    }
    if (cleaned.startsWith('963')) {
        return '0' + cleaned.substring(3);
    }
    return cleaned;
};

// Validate password strength
const isValidPassword = (password) => {
    // Minimum 8 characters, at least one letter and one number
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
};

/**
 * POST /api/auth/register
 * Register a new user with phone + password
 */
router.post('/register', validate(schemas.register), async (req, res) => {
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
            return res.status(500).json({
                error: 'فشل إنشاء الحساب',
                code: 'CREATE_FAILED'
            });
        }

        // Initialize user credits
        await supabase
            .from('user_credits')
            .insert({
                custom_user_id: newUser.id,
                balance: 0,
                total_earned: 0,
                total_spent: 0,
                video_watch_minutes: 0,
                article_credits: 0
            });

        // Generate token and create session
        const token = generateToken(newUser.id);
        const deviceInfo = req.headers['user-agent'] || null;
        const ipAddress = req.ip || req.connection.remoteAddress;

        await createSession(newUser.id, token, deviceInfo, ipAddress);

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
        res.status(500).json({
            error: 'حدث خطأ أثناء التسجيل',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/auth/login
 * Login with phone + password
 */
router.post('/login', validate(schemas.login), async (req, res) => {
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
            return res.status(401).json({
                error: 'رقم الهاتف أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS'
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
            return res.status(401).json({
                error: 'رقم الهاتف أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS'
            });
        }

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
        res.status(500).json({
            error: 'حدث خطأ أثناء تسجيل الدخول',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticateUser, async (req, res) => {
    try {
        await invalidateSession(req.sessionId);

        res.json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'حدث خطأ أثناء تسجيل الخروج',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticateUser, async (req, res) => {
    try {
        await invalidateAllUserSessions(req.user.id);

        res.json({
            success: true,
            message: 'تم تسجيل الخروج من جميع الأجهزة'
        });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            error: 'حدث خطأ',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', authenticateUser, async (req, res) => {
    try {
        // Get user with credits
        const { data: credits } = await supabase
            .from('user_credits')
            .select('balance, video_watch_minutes, article_credits, total_earned, total_spent')
            .eq('custom_user_id', req.user.id)
            .single();

        res.json({
            user: {
                id: req.user.id,
                phone_number: req.user.phoneNumber,
                display_name: req.user.displayName,
                created_at: req.user.createdAt
            },
            credits: credits || {
                balance: 0,
                video_watch_minutes: 0,
                article_credits: 0,
                total_earned: 0,
                total_spent: 0
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            error: 'حدث خطأ',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticateUser, async (req, res) => {
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
        res.status(500).json({
            error: 'حدث خطأ أثناء التحديث',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * PUT /api/auth/change-password
 * Change password
 */
router.put('/change-password', authenticateUser, async (req, res) => {
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
        res.status(500).json({
            error: 'حدث خطأ أثناء تغيير كلمة المرور',
            code: 'SERVER_ERROR'
        });
    }
});

export default router;
