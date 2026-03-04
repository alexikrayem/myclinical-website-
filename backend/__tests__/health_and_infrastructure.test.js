
import { jest } from '@jest/globals';

// --- Mocks Setup ---
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        auth: { getUser: jest.fn(), signInWithPassword: jest.fn(), signUp: jest.fn() },
        storage: { from: jest.fn().mockReturnThis(), upload: jest.fn(), getPublicUrl: jest.fn() },
        then: function (resolve) { resolve({ data: {}, error: null }); }
    }))
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn().mockResolvedValue(null),
    isRedisAvailable: jest.fn().mockReturnValue(false)
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    limiters: {}
}));

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Health & Infrastructure Tests', () => {

    describe('GET /health', () => {
        it('should return 200 with status OK', async () => {
            const res = await request(app).get('/health');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('OK');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('environment');
            expect(res.body.security).toBe('enabled');
        });
    });

    describe('GET /security-status', () => {
        it('should return 200 with security info', async () => {
            const res = await request(app).get('/security-status');

            expect(res.status).toBe(200);
            expect(res.body.headers).toBe('enabled');
            expect(res.body.rateLimiting).toBe('enabled');
            expect(res.body.inputSanitization).toBe('enabled');
            expect(res.body.cors).toBe('configured');
            expect(res.body.fileValidation).toBe('enabled');
        });
    });

    describe('404 Handler', () => {
        it('should return 404 for unknown API routes', async () => {
            const res = await request(app).get('/api/nonexistent-endpoint');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('API endpoint not found');
        });

        it('should return 404 for unknown API POST routes', async () => {
            const res = await request(app)
                .post('/api/nonexistent-endpoint')
                .send({ data: 'test' });

            expect(res.status).toBe(404);
        });
    });

    describe('Security Headers', () => {
        it('should include security headers in response', async () => {
            const res = await request(app).get('/health');

            // Helmet headers
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('DENY');

            // Custom security headers
            expect(res.headers['x-xss-protection']).toBe('1; mode=block');
            expect(res.headers['permissions-policy']).toContain('geolocation=()');
        });
    });

    describe('CORS', () => {
        it('should handle OPTIONS requests', async () => {
            const res = await request(app)
                .options('/api/articles')
                .set('Origin', 'http://localhost:5173')
                .set('Access-Control-Request-Method', 'GET');

            // Should not error out
            expect(res.status).toBeLessThan(500);
        });
    });
});
