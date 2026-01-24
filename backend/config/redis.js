import { createClient } from 'redis';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

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
                if (retries > 5) {
                    logger.warn('⚠️ Redis max retries reached. Falling back to memory store.');
                    return new Error('Redis max retries reached');
                }
                return Math.min(retries * 50, 1000);
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

// Initialize immediately but don't block
const redisPromise = initRedis();

export const getRedisClient = async () => {
    return await redisPromise;
};

export const isRedisAvailable = () => redisAvailable;
