import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';

// Cache middleware
export const cacheMiddleware = (duration = 300) => async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
        return next();
    }

    const client = await getRedisClient();
    // Fallback if Redis is not available
    if (!client || !client.isOpen) {
        return next();
    }

    const key = `cache:${req.originalUrl || req.url}`;

    try {
        const cachedData = await client.get(key);
        if (cachedData) {
            const data = JSON.parse(cachedData);
            // Return cached response
            return res.json(data);
        }

        // Override res.json to store response in cache
        const originalJson = res.json;
        res.json = function (body) {
            // Only cache successful responses (2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Store in redis asynchronously
                client.set(key, JSON.stringify(body), {
                    EX: duration // Expiration in seconds
                }).catch(err => logger.error('Redis Cache Error:', err));
            }

            // Call original json method
            return originalJson.call(this, body);
        };

        next();
    } catch (error) {
        logger.error('Cache Middleware Error:', error);
        next();
    }
};

// Helper to immediately clear specific cache keys
export const invalidateCache = async (keys = []) => {
    try {
        const client = await getRedisClient();
        if (!client || !client.isOpen) return;

        for (const key of keys) {
            await client.del(key);
        }
    } catch (error) {
        logger.error('Cache Invalidation Error:', error);
    }
};

// Helper to clear keys matching a pattern (e.g. 'cache:/api/articles*')
export const invalidateCachePattern = async (pattern) => {
    try {
        const client = await getRedisClient();
        if (!client || !client.isOpen) return;

        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
        }
    } catch (error) {
        logger.error('Cache Pattern Invalidation Error:', error);
    }
};
