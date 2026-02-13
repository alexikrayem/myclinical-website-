import { jest } from '@jest/globals';
import supertest from 'supertest';

// Mock global fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// --- Mocks ---
const mockSupabase = {
    auth: {
        signInWithPassword: jest.fn()
    },
    from: jest.fn(),
    rpc: jest.fn()
};

// Mock Redis client for rate limiting and lockout
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    increment: jest.fn(),
    sendCommand: jest.fn(),
    isOpen: true
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis))
}));

// Mock authLimiter to bypass specific rate limiting lib logic
jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    authLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next()
}));

// Import app
const { default: app } = await import('../server.js');

describe('Login Security (Rate Limiting & Lockout)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Redis behavior
        mockRedis.get.mockResolvedValue(null); // No previous attempts
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.del.mockResolvedValue(1);
    });

    describe('Admin Login', () => {
        const adminEmail = 'admin@example.com';
        const endpoint = '/api/admin/login';

        it('should track failed attempts', async () => {
            // Mock auth failure
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { user: null },
                error: { message: 'Invalid login' }
            });

            // Mock redis to return 0 attempts initially
            mockRedis.get.mockResolvedValue(JSON.stringify({ count: 0 }));

            const res = await supertest(app)
                .post(endpoint)
                .send({ email: adminEmail, password: 'wrongpassword' });

            expect(res.status).toBe(401);
            // Verify trackLoginAttempt logic touched redis
            expect(mockRedis.set).toHaveBeenCalled();
            // Expect remaining attempts in body
            expect(res.body.remainingAttempts).toBeDefined();
        });

        it('should lock out user after max attempts', async () => {
            // Mock redis to verify locked state in checkLoginAllowed
            // checkLoginAllowed is middleware.
            const lockedUntil = Date.now() + 60000;
            mockRedis.get.mockResolvedValue(JSON.stringify({
                count: 5,
                lockedUntil: lockedUntil
            }));

            const res = await supertest(app)
                .post(endpoint)
                .send({ email: adminEmail, password: 'any' });

            expect(res.status).toBe(429); // Too Many Requests
            expect(res.body.error).toMatch(/temporarily locked/);
        });
    });

    describe('User Login', () => {
        const userPhone = '0912345678';
        const endpoint = '/api/auth/login';

        it('should track failed attempts on invalid credentials', async () => {
            // Mock user not found or invalid password
            mockSupabase.from.mockReturnValue({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
                    }))
                }))
            });

            const res = await supertest(app)
                .post(endpoint)
                .send({ phone_number: userPhone, password: 'wrongpassword' });

            expect(res.status).toBe(401);
            // Verify redis was called to track attempt
            expect(mockRedis.set).toHaveBeenCalled();
            expect(res.body.remainingAttempts).toBeDefined();
        });

        it('should lock out user after max attempts', async () => {
            const lockedUntil = Date.now() + 60000;
            mockRedis.get.mockResolvedValue(JSON.stringify({
                count: 5,
                lockedUntil: lockedUntil
            }));

            const res = await supertest(app)
                .post(endpoint)
                .send({ phone_number: userPhone, password: 'any' });

            expect(res.status).toBe(429);
            expect(res.body.error).toMatch(/temporarily locked/);
        });
    });
});
