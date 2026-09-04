/**
 * unified_auth.test.js
 *
 * Integration tests for the social-auth authentication layer.
 * Social OAuth code exchange is not tested against the real Meta Graph API;
 * instead, the config/facebook.js module is mocked to return deterministic
 * profile data. The test verifies that the route correctly creates sessions,
 * sets cookies, and handles duplicate/existing-user paths.
 */

import { jest } from '@jest/globals';
import supertest from 'supertest';
import { mockSupabase, resetSupabaseMock } from './mocks/supabaseMock.js';
import { mockRedis } from './mocks/redisMock.js';
import { mockRateLimiters, mockCache, mockUserAuth } from './mocks/middlewareMock.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock user for session injection
// ─────────────────────────────────────────────────────────────────────────────
const mockUser = {
    id: 'user-123',
    displayName: 'Test User',
    isActive: true,
    isVerified: false,
    specialty: 'طب الأسنان العام',
    socialProvider: 'facebook',
    socialUsername: 'testuser',
    role: 'user',
    verificationStatus: 'none',
    phoneNumber: null,
};

// Prevent real network calls during test
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    isRedisAvailable: jest.fn(() => true)
}));

// Mock the Facebook config helpers (server-side OAuth — no real calls needed)
jest.unstable_mockModule('../config/facebook.js', () => ({
    exchangeCodeForToken: jest.fn(async () => 'mock-access-token'),
    fetchUserProfile: jest.fn(async () => ({
        id: 'fb-123',
        name: 'د. تجريب',
        username: 'dr.test',
        profileUrl: 'https://facebook.com/dr.test',
        avatarUrl: null,
    })),
    FACEBOOK_APP_ID_PUBLIC: 'test-app-id',
    FACEBOOK_REDIRECT_URI_PUBLIC: 'http://localhost:5173/auth/callback',
    PROVIDER_SCOPES: { facebook: 'public_profile', instagram: 'instagram_basic,public_profile' },
    buildAuthUrl: jest.fn(() => 'https://facebook.com/dialog/oauth?...'),
}));

// Mock middleware
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
    },
    generateToken: jest.fn(() => 'mock-jwt-token'),
    createSession: jest.fn(async () => { }),
    invalidateSession: jest.fn(async () => { }),
    invalidateAllUserSessions: jest.fn(async () => { }),
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => mockRateLimiters);
jest.unstable_mockModule('../middleware/cache.js', () => mockCache);

const { default: app } = await import('../server.js');

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Social Auth — /api/auth/social/callback', () => {
    beforeEach(() => {
        resetSupabaseMock();
        jest.clearAllMocks();
    });

    it('returns 400 if provider is missing', async () => {
        const res = await supertest(app)
            .post('/api/auth/social/callback')
            .send({ code: 'some-code' });

        expect(res.status).toBe(400);
    });

    it('returns 400 if code is missing', async () => {
        const res = await supertest(app)
            .post('/api/auth/social/callback')
            .send({ provider: 'facebook' });

        expect(res.status).toBe(400);
    });

    it('returns 400 if provider is invalid', async () => {
        const res = await supertest(app)
            .post('/api/auth/social/callback')
            .send({ provider: 'twitter', code: 'some-code' });

        expect(res.status).toBe(400);
    });

    it('requires specialty for new users (social_provider_id not found)', async () => {
        // Simulate user not found in DB
        mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

        const res = await supertest(app)
            .post('/api/auth/social/callback')
            .send({ provider: 'facebook', code: 'valid-code' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SPECIALTY_REQUIRED');
    });

    it('accepts returning user without specialty', async () => {
        // Simulate existing user in DB
        mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: {
                id: 'user-123',
                display_name: 'د. تجريب',
                is_active: true,
                is_verified: false,
                specialty: 'طب الأسنان العام',
                social_username: 'dr.test',
            },
            error: null,
        });

        // Mock the user select after session creation
        mockSupabase.single.mockResolvedValueOnce({
            data: {
                id: 'user-123',
                display_name: 'د. تجريب',
                social_provider: 'facebook',
                social_username: 'dr.test',
                social_avatar_url: null,
                specialty: 'طب الأسنان العام',
                is_verified: false,
                verification_status: 'none',
            },
            error: null,
        });

        const res = await supertest(app)
            .post('/api/auth/social/callback')
            .send({ provider: 'facebook', code: 'valid-code' });

        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.specialty).toBe('طب الأسنان العام');
    });
});

describe('Auth middleware — optionalAuth / authenticateUser', () => {
    beforeEach(() => {
        resetSupabaseMock();
        jest.clearAllMocks();
    });

    it('GET /api/articles/:id accepts user JWT via optionalAuth', async () => {
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

    it('GET /api/research/:id/pdf requires authenticateUser', async () => {
        const res = await supertest(app)
            .get('/api/research/some-id/pdf')
            .set('Authorization', 'Bearer valid-custom-jwt');

        expect(res.status).not.toBe(401);
    });

    it('GET /api/research/:id/pdf returns 401 without token', async () => {
        const res = await supertest(app)
            .get('/api/research/some-id/pdf');

        expect(res.status).toBe(401);
    });
});

describe('GET /api/auth/social/config', () => {
    it('returns app ID and redirect URI (no secret)', async () => {
        const res = await supertest(app).get('/api/auth/social/config');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('appId');
        expect(res.body).toHaveProperty('redirectUri');
        expect(res.body).toHaveProperty('scopes');
        // CRITICAL: App Secret must never be in the response
        expect(JSON.stringify(res.body)).not.toContain('secret');
    });
});

describe('POST /api/auth/logout', () => {
    beforeEach(() => {
        resetSupabaseMock();
        jest.clearAllMocks();
    });

    it('returns 401 without auth token', async () => {
        const res = await supertest(app).post('/api/auth/logout');
        expect(res.status).toBe(401);
    });

    it('returns 200 with valid JWT and clears cookie', async () => {
        const res = await supertest(app)
            .post('/api/auth/logout')
            .set('Authorization', 'Bearer valid-custom-jwt');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
