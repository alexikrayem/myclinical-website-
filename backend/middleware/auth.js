import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

import { getRedisClient } from '../config/redis.js';

// Helper to get redis key
const getLoginKey = (identifier) => `login_attempts:${identifier.toLowerCase()}`;
const LOCK_DURATION = 15 * 60; // 15 minutes in seconds

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token is required',
      code: 'NO_TOKEN'
    });
  }

  try {
    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      // Don't log full error in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Token verification error:', error);
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
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (adminError || !adminData) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Admin verification error:', adminError);
      }
      return res.status(403).json({
        error: 'Access denied - insufficient permissions',
        code: 'NOT_ADMIN'
      });
    }

    // Add user info to request
    req.user = data.user;
    req.admin = adminData;

    // Add timestamp for session tracking
    req.authTime = Date.now();

    next();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Authentication error:', error);
    }
    res.status(403).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Track and limit failed login attempts
export const trackLoginAttempt = async (identifier, success) => {
  const client = await getRedisClient();
  // Fallback to memory if no redis (simplified: allow if redis down)
  if (!client) return { allowed: true };

  const key = getLoginKey(identifier);

  if (success) {
    // Reset on successful login
    await client.del(key);
    return { allowed: true };
  } else {
    // Check current attempts
    let attempts = await client.get(key);
    attempts = attempts ? JSON.parse(attempts) : { count: 0, lockedUntil: null };
    const now = Date.now();

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

  const client = await getRedisClient();
  if (!client) return next();

  const key = getLoginKey(identifier);
  const data = await client.get(key);

  if (data) {
    const attempts = JSON.parse(data);
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingTime = Math.ceil((attempts.lockedUntil - Date.now()) / 1000 / 60);
      return res.status(429).json({
        error: `Account temporarily locked due to multiple failed login attempts. Try again in ${remainingTime} minutes.`,
        code: 'ACCOUNT_LOCKED',
        retryAfter: remainingTime * 60
      });
    }
  }

  next();
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