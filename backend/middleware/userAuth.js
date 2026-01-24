import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Middleware to authenticate regular users (not admins)
 * Uses JWT tokens stored in Authorization header
 */
export const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'رجاء تسجيل الدخول أولاً',
            code: 'NO_TOKEN'
        });
    }

    try {
        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if session is still active in database
        const { data: session, error: sessionError } = await supabase
            .from('user_sessions')
            .select('*, users(*)')
            .eq('user_id', decoded.userId)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (sessionError || !session) {
            return res.status(403).json({
                error: 'انتهت صلاحية الجلسة. رجاء تسجيل الدخول مرة أخرى',
                code: 'SESSION_EXPIRED'
            });
        }

        // Check if user is active
        if (!session.users.is_active) {
            return res.status(403).json({
                error: 'تم تعطيل الحساب',
                code: 'ACCOUNT_DISABLED'
            });
        }

        // Add user info to request
        req.user = {
            id: session.users.id,
            phoneNumber: session.users.phone_number,
            displayName: session.users.display_name,
            isActive: session.users.is_active,
            createdAt: session.users.created_at
        };
        req.sessionId = session.id;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                error: 'انتهت صلاحية الرمز. رجاء تسجيل الدخول مرة أخرى',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                error: 'رمز غير صالح',
                code: 'INVALID_TOKEN'
            });
        }

        console.error('Authentication error:', error);
        res.status(500).json({
            error: 'خطأ في المصادقة',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Optional authentication - doesn't require token but adds user if present
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .eq('is_active', true)
            .single();

        req.user = user ? {
            id: user.id,
            phoneNumber: user.phone_number,
            displayName: user.display_name,
            isActive: user.is_active
        } : null;

        next();
    } catch (error) {
        // Token invalid, but that's okay for optional auth
        req.user = null;
        next();
    }
};

/**
 * Generate JWT token for user
 */
export const generateToken = (userId) => {
    return jwt.sign(
        { userId, type: 'user' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

/**
 * Create session in database
 */
export const createSession = async (userId, token, deviceInfo = null, ipAddress = null) => {
    const tokenHash = Buffer.from(token).toString('base64').substring(0, 64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const { data, error } = await supabase
        .from('user_sessions')
        .insert({
            user_id: userId,
            token_hash: tokenHash,
            device_info: deviceInfo,
            ip_address: ipAddress,
            expires_at: expiresAt.toISOString(),
            is_active: true
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating session:', error);
        throw error;
    }

    return data;
};

/**
 * Invalidate session
 */
export const invalidateSession = async (sessionId) => {
    const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

    if (error) {
        console.error('Error invalidating session:', error);
        throw error;
    }
};

/**
 * Invalidate all user sessions
 */
export const invalidateAllUserSessions = async (userId) => {
    const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);

    if (error) {
        console.error('Error invalidating sessions:', error);
        throw error;
    }
};

export { JWT_SECRET };
