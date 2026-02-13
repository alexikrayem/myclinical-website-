import { jest } from '@jest/globals'; // Import methods directly
import supertest from 'supertest';

// Mock global fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// Mock Users
const mockUser = {
    id: 'user-123',
    phone_number: '0912345678',
    display_name: 'Test User',
    is_active: true
};

// --- Controlled Mocks ---
// We use a shared object to control mock behavior from current test
const mockState = {
    sessionResult: { data: null, error: { message: 'Inited as null' } },
    profileResult: { data: mockUser, error: null }
};

// Mock functions for spies
const sessionChain = {
    single: jest.fn(),
    gt: jest.fn(),
    eqActive: jest.fn(),
    eqHash: jest.fn(),
    eqUser: jest.fn()
};

const profileChain = {
    single: jest.fn(),
    eq: jest.fn()
};

const creditsChain = {
    single: jest.fn(),
    eq: jest.fn()
};

// Supabase Mock Implementation
const mockSupabase = {
    from: jest.fn((table) => {
        if (table === 'user_sessions') {
            // Complex chain: .eq(user).eq(hash).eq(active).gt(date).single()
            sessionChain.single.mockResolvedValue(mockState.sessionResult);
            sessionChain.gt.mockReturnValue({ single: sessionChain.single });
            sessionChain.eqActive.mockReturnValue({ gt: sessionChain.gt });
            sessionChain.eqHash.mockReturnValue({ eq: sessionChain.eqActive });
            sessionChain.eqUser.mockReturnValue({ eq: sessionChain.eqHash });

            return {
                select: jest.fn(() => ({ eq: sessionChain.eqUser })),
                insert: jest.fn(),
                update: jest.fn()
            };
        } else if (table === 'users') {
            // Simple chain: .eq(id).single()
            profileChain.single.mockResolvedValue(mockState.profileResult);
            profileChain.eq.mockReturnValue({ single: profileChain.single });

            return {
                select: jest.fn(() => ({ eq: profileChain.eq })),
                insert: jest.fn(),
                update: jest.fn()
            };
        } else if (table === 'user_credits') {
            // Chain: .select(...).eq(...).single()
            const mockCredits = {
                balance: 0, video_watch_minutes: 0, article_credits: 0, total_earned: 0, total_spent: 0
            };
            creditsChain.single.mockResolvedValue({ data: mockCredits, error: null });
            creditsChain.eq.mockReturnValue({ single: creditsChain.single });

            return {
                select: jest.fn(() => ({ eq: creditsChain.eq })),
                insert: jest.fn(),
                update: jest.fn()
            };
        }
        return { select: jest.fn().mockReturnThis() };
    })
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next()
}));

// Import app after mocks
const { default: app } = await import('../server.js');
const { JWT_SECRET } = await import('../middleware/userAuth.js');
import jwt from 'jsonwebtoken';

describe('Session Validation Security', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset default mock state
        mockState.sessionResult = { data: null, error: { message: 'Default not found' } };
        mockState.profileResult = { data: mockUser, error: null };
    });

    it('should reject a valid JWT if the session does not exist in DB (Revoked)', async () => {
        // Setup state for this test
        mockState.sessionResult = { data: null, error: { message: 'Not found' } };

        const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET);

        const res = await supertest(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SESSION_EXPIRED');

        // Verify valid chain was called
        expect(sessionChain.eqUser).toHaveBeenCalled();
        expect(sessionChain.eqHash).toHaveBeenCalled(); // The critical check
    });

    it('should accept a valid JWT if session exists and hash matches', async () => {
        const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET);
        const tokenHash = Buffer.from(token).toString('base64').substring(0, 64);

        const mockSessionData = {
            id: 'session-123',
            user_id: 'user-123',
            token_hash: tokenHash,
            users: mockUser,
            is_active: true
        };

        // Setup state
        mockState.sessionResult = { data: mockSessionData, error: null };

        const res = await supertest(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.id).toBe('user-123');
    });

    it('should handle multiple active sessions correctly by verifying the specific token', async () => {
        const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET);
        const tokenHash = Buffer.from(token).toString('base64').substring(0, 64);

        const mockSessionData = {
            id: 'session-123',
            user_id: 'user-123',
            token_hash: tokenHash,
            users: mockUser,
            is_active: true
        };

        // Setup state
        mockState.sessionResult = { data: mockSessionData, error: null };

        const res = await supertest(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });
});
