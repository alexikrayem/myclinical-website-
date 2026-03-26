import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getRedisClient } from '../config/redis.js';
import { supabaseAdmin } from '../config/supabase.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start with an insecure default.');
}
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

        // Hash token securely
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const redisClient = await getRedisClient();
        const cacheKey = `session:${tokenHash}`;

        if (redisClient) {
            try {
                const cachedSession = await redisClient.get(cacheKey);
                if (cachedSession) {
                    const sessionData = JSON.parse(cachedSession);
                    req.user = sessionData.user;
                    req.sessionId = sessionData.sessionId;
                    return next();
                }
            } catch (err) {
                console.error('Redis cache error:', err);
            }
        }

        // Check if session is still active in database
        const { data: session, error: sessionError } = await supabaseAdmin
            .from('user_sessions')
            .select('*, users(*)')
            .eq('user_id', decoded.userId)
            .eq('token_hash', tokenHash) // Match specific token
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

        if (redisClient) {
            try {
                const payload = {
                    user: req.user,
                    sessionId: req.sessionId
                };
                // Cache for 1 hour to reduce DB hits
                await redisClient.set(cacheKey, JSON.stringify(payload), { EX: 3600 });
            } catch (err) {
                console.error('Redis set error:', err);
            }
        }

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

        const { data: user } = await supabaseAdmin
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
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const { data, error } = await supabaseAdmin
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
    // Get token_hash to remove from cache
    const { data: sessionData } = await supabaseAdmin
        .from('user_sessions')
        .select('token_hash')
        .eq('id', sessionId)
        .single();

    const { error } = await supabaseAdmin
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

    if (error) {
        console.error('Error invalidating session:', error);
        throw error;
    }

    if (sessionData && sessionData.token_hash) {
        const redisClient = await getRedisClient();
        if (redisClient) {
            await redisClient.del(`session:${sessionData.token_hash}`).catch(e => console.error('Redis del error:', e));
        }
    }
};

/**
 * Invalidate all user sessions
 */
export const invalidateAllUserSessions = async (userId) => {
    // Get token hashes to remove from cache
    const { data: sessions } = await supabaseAdmin
        .from('user_sessions')
        .select('token_hash')
        .eq('user_id', userId)
        .eq('is_active', true);

    const { error } = await supabaseAdmin
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);

    if (error) {
        console.error('Error invalidating sessions:', error);
        throw error;
    }

    if (sessions && sessions.length > 0) {
        const redisClient = await getRedisClient();
        if (redisClient) {
            const keys = sessions.map(s => `session:${s.token_hash}`);
            if (keys.length > 0) {
                await redisClient.del(keys).catch(e => console.error('Redis del error:', e));
            }
        }
    }
};

export { JWT_SECRET };
