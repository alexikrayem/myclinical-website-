import { jest } from '@jest/globals';
import supertest from 'supertest';
import { mockSupabase, resetSupabaseMock } from './mocks/supabaseMock.js';
import { mockRedis } from './mocks/redisMock.js';
import { mockRateLimiters, mockCache, mockUserAuth } from './mocks/middlewareMock.js';

// --- Mocks Setup for Auth ---
const mockUser = {
    id: 'user-123',
    phone_number: '0912345678',
    display_name: 'Test User',
    is_active: true
};

// Mock global fetch to prevent network errors
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// Mock Supabase
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    isRedisAvailable: jest.fn(() => true)
}));

// Mock Middleware
jest.unstable_mockModule('../middleware/userAuth.js', () => ({
    ...mockUserAuth,
    authenticateUser: (req, res, next) => {
        if (req.headers['authorization'] === 'Bearer valid-custom-jwt') {
            req.user = mockUser;
            req.sessionId = 'session-123';
            return next();
        }
        return res.status(401).json({ error: 'Auth Failed' });
    },
    optionalAuth: (req, res, next) => {
        if (req.headers['authorization'] === 'Bearer valid-custom-jwt') {
            req.user = mockUser;
        } else {
            req.user = null;
        }
        next();
    }
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => mockRateLimiters);
jest.unstable_mockModule('../middleware/cache.js', () => mockCache);

const { default: app } = await import('../server.js');

describe('Unified Authentication Tests', () => {
    beforeEach(() => {
        resetSupabaseMock();
        jest.clearAllMocks();
    });

    it('GET /api/articles/:id should accept custom JWT via optionalAuth', async () => {
        // Mock Article Response
        mockSupabase.single.mockResolvedValueOnce({
            data: {
                id: 'some-id',
                title: 'Test Article',
                file_url: 'test.pdf',
                credits_required: 0
            },
            error: null
        });

        const res = await supertest(app)
            .get('/api/articles/some-id')
            .set('Authorization', 'Bearer valid-custom-jwt');

        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(500);
    });

    it('GET /api/research/:id/pdf should accept custom JWT via authenticateUser', async () => {
        const res = await supertest(app)
            .get('/api/research/some-id/pdf')
            .set('Authorization', 'Bearer valid-custom-jwt');

        // Should pass auth check (hit 404 on resource instead of 401)
        expect(res.status).not.toBe(401);
    });

    it('GET /api/research/:id/pdf should fail without token', async () => {
        const res = await supertest(app)
            .get('/api/research/some-id/pdf');

        // Should fail auth check
        expect(res.status).toBe(401);
    });
});
