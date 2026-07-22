import crypto from 'crypto';
import { supabaseAdmin, supabasePublic } from '../config/supabase.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';

// Helper to get Redis key — composite identifier:ip prevents targeted account-lockout DOS.
// An attacker from a different IP cannot lock out a legitimate user's account.
const getLoginKey = (identifier, ip = 'unknown') =>
  `login_attempts:${identifier.toLowerCase()}:${ip.replace(/[^\w.:]/g, '_')}`;
const LOCK_DURATION = 15 * 60; // 15 minutes in seconds


export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const cookieToken = req.cookies?.session;
  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token is required',
      code: 'NO_TOKEN'
    });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `auth_token_v1:${tokenHash}`;
    const client = await getRedisClient();

    // Check cache first
    if (client) {
      const cached = await client.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        req.user = parsed.user;
        req.admin = parsed.admin;
        req.authTime = Date.now();
        return next();
      }
    }

    // Verify the token with Supabase
    const { data, error } = await supabasePublic.auth.getUser(token);

    if (error) {
      // Don't log full error in production
      if (process.env.NODE_ENV === 'development') {
        logger.error('Token verification error:', error);
      }
      return res.status(403).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    if (!data.user) {
      return res.status(403).json({
        error: 'Invalid token - no user found',
        code: 'NO_USER'
      });
    }

    // Check if the user is an admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (adminError || !adminData) {
      if (process.env.NODE_ENV === 'development') {
        logger.error('Admin verification error:', adminError);
      }
      return res.status(403).json({
        error: 'Access denied - insufficient permissions',
        code: 'NOT_ADMIN'
      });
    }

    // Add user info to request
    req.user = data.user;
    req.admin = adminData;

    // Optional: Cache auth result in Redis with a 60-second TTL.
    // A short TTL limits the window where a revoked/demoted admin can still access protected routes.
    // TODO: For instant revocation, delete `auth_token_v1:<tokenHash>` key when admin role changes in DB.
    if (client) {
      const cachePayload = JSON.stringify({ user: req.user, admin: req.admin });
      try {
        await client.set(cacheKey, cachePayload, { EX: 60 });
      } catch (err) {
        logger.error('Redis cache error:', err);
      }
    }

    // Add timestamp for session tracking
    req.authTime = Date.now();

    next();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('Authentication error:', error);
    }
    res.status(403).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Track and limit failed login attempts
// @param identifier  - phone number or email (normalised)
// @param success     - true on successful auth, false on failure
// @param ip          - request IP; combined with identifier to prevent targeted DOS
export const trackLoginAttempt = async (identifier, success, ip = 'unknown') => {
  const client = await getRedisClient();
  const key = getLoginKey(identifier, ip);
  const now = Date.now();

  // Fail-closed (M5 full fix): if Redis is unavailable we cannot enforce a
  // globally consistent rate limit across all instances, so we reject the
  // attempt and surface a 503 to the caller.  Using an insecure per-process
  // fallback would allow N × maxAttempts bypass in multi-instance deployments.
  if (!client) {
    logger.error('[M5] Redis unavailable — rejecting login attempt to enforce fail-closed rate limiting.');
    return {
      allowed: false,
      serviceUnavailable: true,
      reason: 'Authentication service temporarily unavailable. Please try again shortly.'
    };
  }

  if (success) {
    // Reset on successful login
    await client.del(key);
    return { allowed: true };
  } else {
    // Check current attempts
    let attempts = await client.get(key);
    attempts = attempts ? JSON.parse(attempts) : { count: 0, lockedUntil: null };

    // Check if account is locked
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      const remainingTime = Math.ceil((attempts.lockedUntil - now) / 1000 / 60);
      return {
        allowed: false,
        reason: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: attempts.lockedUntil
      };
    }

    // Increment failed attempts
    attempts.count++;
    attempts.timestamp = now;

    // Lock account after 5 failed attempts
    if (attempts.count >= 5) {
      attempts.lockedUntil = now + (LOCK_DURATION * 1000); // Lock for 15 minutes
      // Store with TTL
      await client.set(key, JSON.stringify(attempts), { EX: LOCK_DURATION });
      return {
        allowed: false,
        reason: 'Too many failed login attempts. Account locked for 15 minutes.',
        lockedUntil: attempts.lockedUntil
      };
    }

    // Store update
    await client.set(key, JSON.stringify(attempts), { EX: LOCK_DURATION });

    return {
      allowed: true,
      remainingAttempts: 5 - attempts.count
    };
  }
};

// Check if login is allowed before attempting
export const checkLoginAllowed = async (req, res, next) => {
  const identifier = req.body.email || req.body.phone_number || req.ip;
  if (!identifier) return next();

  const ip = req.ip || 'unknown';
  const client = await getRedisClient();
  const key = getLoginKey(identifier, ip);
  const now = Date.now();

  // Fail-closed: if Redis is down, block the login attempt.
  // The caller (login route) will surface a 503 to the client.
  if (!client) {
    logger.error('[M5] Redis unavailable — blocking login attempt (fail-closed).');
    return res.status(503).json({
      error: 'Authentication service temporarily unavailable. Please try again shortly.',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  const data = await client.get(key);

  if (data) {
    const attempts = JSON.parse(data);
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      const remainingTime = Math.ceil((attempts.lockedUntil - now) / 1000 / 60);
      return res.status(429).json({
        error: `Account temporarily locked due to multiple failed login attempts. Try again in ${remainingTime} minutes.`,
        code: 'ACCOUNT_LOCKED',
        retryAfter: remainingTime * 60
      });
    }
  }

  next();
};

/**
 * Immediately invalidates the Redis cached auth entry for a given raw Supabase
 * access token.  Call this on every admin logout / role change so in-flight
 * requests can't continue to use the cached identity for up to the 60-second TTL.
 */
export const revokeTokenCache = async (rawToken) => {
  if (!rawToken) return;
  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const cacheKey = `auth_token_v1:${tokenHash}`;
    const client = await getRedisClient();
    if (client) {
      await client.del(cacheKey);
    }
  } catch (err) {
    logger.error('revokeTokenCache error:', err);
  }
};

// Optional: Role-based access control
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'NO_ADMIN_DATA'
      });
    }

    if (allowedRoles.includes(req.admin.role)) {
      next();
    } else {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
  };
};
