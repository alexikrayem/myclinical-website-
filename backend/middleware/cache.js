
import { getRedisClient } from '../config/redis.js';

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
            // Store in redis asynchronously
            client.set(key, JSON.stringify(body), {
                EX: duration // Expiration in seconds
            }).catch(err => console.error('Redis Cache Error:', err));

            // Call original json method
            return originalJson.call(this, body);
        };

        next();
    } catch (error) {
        console.error('Cache Middleware Error:', error);
        next();
    }
};

// Helper middleware to clear cache pattern
export const clearCache = (pattern) => async (req, res, next) => {
    // Continue with request first, then clear cache
    // Or clear after response? Usually better after response success.
    // We'll hook into res.on('finish') or just fire and forget if safe.
    // For simplicity, let's fire and forget, but maybe wait for operation success if critical.

    // Execute next() and hook into the end
    const originalEnd = res.end;
    res.end = function (...args) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            getRedisClient().then(async client => {
                if (client && client.isOpen) {
                    // Pattern-based delete requires keys scan which is slow.
                    // Better to just delete specific known keys or rely on short TTL.
                    // But for 'articles', we might want to clear list cache.
                    // Let's assume pattern is a simple prefix or exact key.

                    // Optimization: Use a set to track related keys? 
                    // Or just simplified: clear specific common keys like '/api/articles'

                    // For now, let's just log or try scan if pattern provided
                    if (pattern) {
                        // Note: creating a robust cache invalidation is complex. 
                        // We will implement simple key deletion if pattern is exact, 
                        // or skip complex scan for this iteration to avoid performance hit.

                        // If pattern is 'articles', we might clear '/api/articles' and '/api/articles/featured'
                        if (pattern === 'articles') {
                            await client.del('cache:/api/articles');
                            await client.del('cache:/api/articles/featured');
                        }
                    }
                }
            }).catch(err => console.error('Cache Clear Error:', err));
        }
        originalEnd.apply(this, args);
    };
    next();
};
