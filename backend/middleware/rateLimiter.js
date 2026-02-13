

import rateLimit, { MemoryStore } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js'; // Use logger

// Helper to create store with hybrid fallback
const createHybridStore = (prefix) => {
  const memoryStore = new MemoryStore(); // Fallback store
  let redisStore;

  return {
    init: async function (options) {
      // Initialize memory store
      memoryStore.init(options);

      const client = await getRedisClient();
      if (client && client.isOpen) {
        redisStore = new RedisStore({
          sendCommand: (...args) => client.sendCommand(args),
          prefix: `rate_limit:${prefix}:`,
        });
        // Initialize the RedisStore so windowMs is set
        redisStore.init(options);
      }
    },
    increment: async function (key) {
      if (redisStore) {
        try {
          return await redisStore.increment(key);
        } catch (error) {
          logger.warn(`Redis rate limit error, falling back to memory: ${error.message}`);
          redisStore = null; // Disable redis temporarily or permanently? 
          // For safety, fallback this time.
        }
      }
      return memoryStore.increment(key);
    },
    decrement: async function (key) {
      if (redisStore) {
        try { return await redisStore.decrement(key); } catch (e) { redisStore = null; }
      }
      return memoryStore.decrement(key);
    },
    resetKey: async function (key) {
      if (redisStore) {
        try { return await redisStore.resetKey(key); } catch (e) { redisStore = null; }
      }
      return memoryStore.resetKey(key);
    }
  };
};

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: createHybridStore('api'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    error: 'Too many login attempts from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Your account has been temporarily locked for security.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    error: 'Too many file uploads from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for AI generation endpoints
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 AI generations per hour
  message: {
    error: 'Too many AI generation requests, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: {
    error: 'Too many search requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});