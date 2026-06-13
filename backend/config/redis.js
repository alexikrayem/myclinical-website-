import { createClient } from 'redis';
import logger from './logger.js';

let redisClient;
let redisAvailable = false;

const initRedis = async () => {
    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Don't log here to avoid noise on import, or log once.
    // logger.info(`🔌 Attempting to connect to Redis at ${redisUrl}...`);

    redisClient = createClient({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries) => {
                // Exponential backoff: 50ms, 100ms, 200ms, 400ms... up to 3000ms
                const delay = Math.min(Math.pow(2, retries) * 50, 3000);

                if (retries > 20) {
                    logger.error(`❌ Redis connection failed after ${retries} retries. Features relying on it will use memory store.`);
                    return new Error(`Redis connection failed after ${retries} retries`);
                }

                return delay;
            }
        }
    });

    redisClient.on('error', (err) => {
        if (redisAvailable || err.code !== 'ECONNREFUSED') {
            logger.error(`❌ Redis Client Error: ${err.message}`);
        }
        redisAvailable = false;
    });

    redisClient.on('connect', () => {
        logger.info('✅ Redis Client Connected');
        redisAvailable = true;
    });

    try {
        await redisClient.connect();
    } catch (err) {
        logger.warn('⚠️ Could not connect to Redis. Features relying on it will degrade to memory-only.');
        redisAvailable = false;
        return null;
    }

    return redisClient;
};

// Initialize immediately but don't block (except in tests to avoid hanging)
const redisPromise = process.env.NODE_ENV === 'test' ? Promise.resolve(null) : initRedis();

export const getRedisClient = async () => {
    const client = await redisPromise;
    if (!client) return null;

    // If the cached client has disconnected since init, attempt one reconnect
    if (!client.isOpen) {
        try {
            logger.warn('Redis client disconnected — attempting reconnect...');
            await client.connect();
            redisAvailable = true;
        } catch (err) {
            logger.error('Redis reconnect failed:', err);
            redisAvailable = false;
            return null;
        }
    }

    return redisAvailable ? client : null;
};

export const isRedisAvailable = () => redisAvailable;
