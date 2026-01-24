
import { jest } from '@jest/globals';

// --- Mocks Setup ---
const createSupabaseMock = () => {
    const builder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        single: jest.fn(),
        rpc: jest.fn(),
        then: function (resolve, reject) {
            resolve({ data: {}, error: null });
        }
    };
    return builder;
};

const mockSupabase = createSupabaseMock();

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
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

// Mock jsonwebtoken
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn((token) => {
            if (token === 'valid-token') return { userId: 'user-123', type: 'user' };
            throw new Error('Invalid token');
        }),
        sign: jest.fn(() => 'valid-token')
    },
    verify: jest.fn((token) => {
        if (token === 'valid-token') return { userId: 'user-123', type: 'user' };
        throw new Error('Invalid token');
    }),
    sign: jest.fn(() => 'valid-token')
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Credits Routes Integration Tests', () => {
    const validToken = 'valid-token';

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.single.mockReset();
        mockSupabase.rpc.mockReset();
    });

    describe('GET /api/credits/balance', () => {
        it('should return user credits', async () => {
            // 1. authenticateUser: check session
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
                error: null
            });

            // 2. get balance
            mockSupabase.single.mockResolvedValueOnce({
                data: { balance: 50, video_watch_minutes: 100 },
                error: null
            });

            const res = await request(app)
                .get('/api/credits/balance')
                .set('Authorization', `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body.balance).toBe(50);
            expect(res.body.video_watch_minutes).toBe(100);
        });
    });

    describe('POST /api/credits/redeem', () => {
        it('should redeem a valid code', async () => {
            // 1. authenticateUser
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
                error: null
            });

            // 2. rpc call
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: true, message: 'Redeemed', new_balance: 100 },
                error: null
            });

            const res = await request(app)
                .post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: 'FREE100' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.credits.balance).toBe(100);
        });

        it('should fail with invalid code', async () => {
            // 1. authenticateUser
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
                error: null
            });

            // 2. rpc call
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: false, message: 'Invalid code' },
                error: null
            });

            const res = await request(app)
                .post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: 'INVALID' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid code');
        });
    });
});
