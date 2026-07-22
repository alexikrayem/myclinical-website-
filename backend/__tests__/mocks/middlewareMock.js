import { jest } from '@jest/globals';

export const mockRateLimiters = {
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    redeemLimiter: (req, res, next) => next(),
    accountRedeemLimiter: (req, res, next) => next(),
    // Added to match the consumeLimiter export on routes/credits.js
    consumeLimiter: (req, res, next) => next(),
    playbackLimiter: (req, res, next) => next(),
    limiters: {}
};

export const mockCache = {
    cacheMiddleware: () => (req, res, next) => next(),
    invalidateCache: jest.fn(),
    invalidateCachePattern: jest.fn()
};

export const mockUserAuth = {
    authenticateUser: (req, res, next) => {
        req.user = { id: 'user-123', role: 'user' };
        next();
    },
    optionalAuth: (req, res, next) => {
        req.user = { id: 'user-123', role: 'user' };
        next();
    },
    generateToken: jest.fn(() => 'mock-token'),
    createSession: jest.fn(() => Promise.resolve('mock-session-id')),
    invalidateSession: jest.fn(() => Promise.resolve()),
    invalidateAllUserSessions: jest.fn(() => Promise.resolve())
};
