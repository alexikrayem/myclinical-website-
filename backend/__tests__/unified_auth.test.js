import { jest } from '@jest/globals';
import supertest from 'supertest';
// import app from '../server.js'; // REMOVED

// Mock global fetch to prevent network errors
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// --- Mocks Setup for Auth ---
const mockUser = {
    id: 'user-123',
    phone_number: '0912345678',
    display_name: 'Test User',
    is_active: true
};

// Comprehensive Mock Helper
const createSupabaseMock = () => {
    const mock = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
            data: {
                id: 'some-id',
                title: 'Test Article',
                file_url: 'test.pdf',
                credits_required: 0,
                content: 'Test content',
                is_featured: false
            },
            error: null
        }),
        auth: {
            getUser: jest.fn().mockImplementation(() => {
                throw new Error('Should not call supabase.auth.getUser');
            })
        }
    };
    return mock;
};

// Mock Supabase
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => createSupabaseMock())
}));

// Mock Middleware (IMPORTANT: We mock the actual middleware logic or behavior)
// To verify the route uses the middleware, we can check if it accepts the user injected by it.
// However, since we are integration testing the route *file*, we want the real middleware OR a mock that behaves like it.
// Let's mock the middleware to simply inject a user if a specific header is present, simulating a pass.

jest.unstable_mockModule('../middleware/userAuth.js', () => ({
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
    },
    // Mock other exports if needed
    generateToken: jest.fn(),
    createSession: jest.fn(),
    invalidateSession: jest.fn(),
    invalidateAllUserSessions: jest.fn()
}));

// Mock rate limiters to avoid issues
jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next()
}));

// Mock global fetch to prevent network errors
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
}));

const { default: app } = await import('../server.js');

describe('Unified Authentication Tests', () => {
    // Note: Since we are mocking modules that are imported by the routes, 
    // we need to be careful about module loading order. 
    // Ideally this would be run in a fresh process or we use valid ESM mocking.
    // Given the environment constraints, we are assuming the previous mocks apply here 
    // or we are relying on these mocks being hoisted if using babel-jest (which we probably are).

    // Actually, in previous tests we saw issues. Let's try to verify behavior.

    it('GET /api/articles/:id should accept custom JWT via optionalAuth', async () => {
        // We expect the route to accept the token and proceed.
        // If it was still using Supabase Auth, it would fail or use a different logic.
        // Our mock middleware injects `req.user`.
        // The route should use `req.user.id`.

        const res = await supertest(app)
            .get('/api/articles/some-id')
            .set('Authorization', 'Bearer valid-custom-jwt');

        // We expect 404 (Article not found) or success, NOT 401/500 from Auth
        // The previous implementation might have ignored this header or failed if it tried to validate it against Supabase.
        // If our mock works, `req.user` is set.

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
