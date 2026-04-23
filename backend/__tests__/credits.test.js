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
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
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
    redeemLimiter: (req, res, next) => next(),
    accountRedeemLimiter: (req, res, next) => next(),
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
        mockSupabase.eq.mockReturnThis();
        mockSupabase.single.mockReset();
        mockSupabase.rpc.mockReset();
    });

    // Helper to mock authentication
    const mockAuth = () => {
        mockSupabase.single.mockResolvedValueOnce({
            data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
            error: null
        });
    };

    describe('GET /api/credits/balance', () => {
        it('should return user credits', async () => {
            mockAuth();
            mockSupabase.single.mockResolvedValueOnce({
                data: { balance: 50, video_watch_minutes: 100 },
                error: null
            });
            mockSupabase.then = jest.fn((resolve) => resolve({ data: [], error: null }));

            const res = await request(app)
                .get('/api/credits/balance')
                .set('Authorization', `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body.balance).toBe(50);
            expect(res.body.video_watch_minutes).toBe(100);
            expect(res.body).toHaveProperty('typed_credits');
        });
    });

    describe('POST /api/credits/redeem', () => {
        it('should redeem a valid code', async () => {
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: true, message: 'Redeemed', new_balance: 100 },
                error: null
            });

            const res = await request(app)
                .post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: 'FREE-1111-2222-3333' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.credits.balance).toBe(100);
        });

        it('should fail with structurally invalid code format', async () => {
            mockAuth();
            const res = await request(app)
                .post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: 'INVALID' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
        });

        it('should fail with valid format but rejected by DB', async () => {
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: false, message: 'Invalid code' },
                error: null
            });

            const res = await request(app)
                .post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: 'BAD-1111-2222-3333' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid code');
        });
    });

    describe('POST /api/credits/consume-video', () => {
        it('should consume video minutes successfully', async () => {
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: true, remaining_minutes: 50, remaining_balance: 10 },
                error: null
            });

            const res = await request(app)
                .post('/api/credits/consume-video')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ minutes: 5, course_id: 'ebb2cdcf-3b9f-43b9-a9a7-96a8e63b65a5' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.remaining_minutes).toBe(50);
        });

        it('should return 400 if insufficient balance in DB', async () => {
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: false, message: 'رصيد غير كافي' },
                error: null
            });

            const res = await request(app)
                .post('/api/credits/consume-video')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ minutes: 500, course_id: 'ebb2cdcf-3b9f-43b9-a9a7-96a8e63b65a5' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('رصيد غير كافي');
            expect(res.body.code).toBe('CREDITS_INSUFFICIENT');
        });
    });

    describe('GET /api/credits/transactions', () => {
        it('should list transactions correctly', async () => {
            mockAuth();
            mockSupabase.then = jest.fn((resolve) => resolve({
                data: [{ id: 1, transaction_type: 'usage' }],
                count: 1,
                error: null
            }));

            const res = await request(app)
                .get('/api/credits/transactions')
                .set('Authorization', `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.pagination.total).toBe(1);
        });
    });
});
