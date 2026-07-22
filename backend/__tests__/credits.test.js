import { jest } from '@jest/globals';
import { mockSupabase, resetSupabaseMock } from './mocks/supabaseMock.js';
import { mockRedis } from './mocks/redisMock.js';
import { mockRateLimiters, mockCache } from './mocks/middlewareMock.js';

// --- Mocks Setup ---
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    isRedisAvailable: jest.fn(() => true)
}));

let redeemCount = 0;
export const resetRedeemCount = () => { redeemCount = 0; };

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    ...mockRateLimiters,
    redeemLimiter: (req, res, next) => {
        redeemCount++;
        if (redeemCount > 3) {
            return res.status(429).json({ error: 'Too many requests, please try again later.' });
        }
        next();
    },
    // consumeLimiter is a pass-through in tests — rate limiting is not under test here
    consumeLimiter: (req, res, next) => next()
}));

// Mock jsonwebtoken
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn((token) => {
            if (token === 'valid-token') return { userId: 'user-123', type: 'user' };
            const error = new Error('Invalid token');
            error.name = token === 'expired-token' ? 'TokenExpiredError' : 'JsonWebTokenError';
            throw error;
        }),
        sign: jest.fn(() => 'valid-token')
    },
    verify: jest.fn((token) => {
        if (token === 'valid-token') return { userId: 'user-123', type: 'user' };
        const error = new Error('Invalid token');
        error.name = token === 'expired-token' ? 'TokenExpiredError' : 'JsonWebTokenError';
        throw error;
    }),
    sign: jest.fn(() => 'valid-token')
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Credits Routes Integration Tests', () => {
    const validToken = 'valid-token';

    beforeEach(() => {
        resetSupabaseMock();
        jest.clearAllMocks();
        redeemCount = 0;
    });

    // Helper to mock authentication
    const mockAuth = () => {
        mockSupabase.single.mockResolvedValueOnce({
            data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
            error: null
        });
    };

    describe('GET /api/credits/balance', () => {
        it('rejects a missing, malformed, or expired token', async () => {
            await expect(request(app).get('/api/credits/balance')).resolves.toMatchObject({ status: 401 });
            await expect(request(app).get('/api/credits/balance').set('Authorization', 'Bearer malformed-token')).resolves.toMatchObject({ status: 403, body: { code: 'INVALID_TOKEN' } });
            await expect(request(app).get('/api/credits/balance').set('Authorization', 'Bearer expired-token')).resolves.toMatchObject({ status: 403, body: { code: 'TOKEN_EXPIRED' } });
        });

        it('should return user credits', async () => {
            mockAuth();
            mockSupabase.single.mockResolvedValueOnce({
                data: { balance: 50, video_watch_minutes: 100 },
                error: null
            });

            // Use the _setResult helper or just mock implementation for transactions
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

        it.each([
            ['', 'empty code'],
            ['<script>alert(1)</script>', 'XSS payload'],
            [`${'A'.repeat(51)}-1111-2222-3333`, 'overlong code'],
        ])('rejects %s (%s) before the RPC', async (code) => {
            mockAuth();
            const res = await request(app).post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`).send({ code });
            expect(res.status).toBe(400);
            expect(mockSupabase.rpc).not.toHaveBeenCalled();
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

        it('should trigger rate limit 429 on excessive brute force attempts', async () => {
            mockAuth();
            mockAuth();
            mockAuth();
            mockAuth();
            mockSupabase.rpc.mockResolvedValue({
                data: { success: false, message: 'Invalid code' },
                error: null
            });

            // 1st request - ok
            await request(app).post('/api/credits/redeem').set('Authorization', `Bearer ${validToken}`).send({ code: '111-1111-2222-3333' });
            // 2nd request - ok
            await request(app).post('/api/credits/redeem').set('Authorization', `Bearer ${validToken}`).send({ code: '111-1111-2222-3333' });
            // 3rd request - ok
            await request(app).post('/api/credits/redeem').set('Authorization', `Bearer ${validToken}`).send({ code: '111-1111-2222-3333' });

            // 4th request - should be 429
            const res4 = await request(app)
                .post('/api/credits/redeem')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ code: '111-1111-2222-3333' });

            expect(res4.status).toBe(429);
            expect(res4.body.error).toContain('Too many requests');
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

        it('should handle concurrent consume requests correctly', async () => {
            mockAuth(); // for both queries
            mockAuth();

            // Simulate parallel success
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, remaining_minutes: 50, remaining_balance: 10 },
                error: null
            });

            const requests = [
                request(app).post('/api/credits/consume-video').set('Authorization', `Bearer ${validToken}`).send({ minutes: 5, course_id: 'ebb2cdcf-3b9f-43b9-a9a7-96a8e63b65a5' }),
                request(app).post('/api/credits/consume-video').set('Authorization', `Bearer ${validToken}`).send({ minutes: 5, course_id: 'ebb2cdcf-3b9f-43b9-a9a7-96a8e63b65a5' })
            ];

            const results = await Promise.all(requests);

            expect(results[0].status).toBe(200);
            expect(results[1].status).toBe(200);
            expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
        });

        it.each([
            [{ minutes: 0, course_id: 'ebb2cdcf-3b9f-43b9-a9a7-96a8e63b65a5' }],
            [{ minutes: -1, course_id: 'ebb2cdcf-3b9f-43b9-a9a7-96a8e63b65a5' }],
            [{ minutes: 1, course_id: 'not-a-uuid' }],
        ])('rejects invalid video consumption input', async (body) => {
            mockAuth();
            const res = await request(app).post('/api/credits/consume-video')
                .set('Authorization', `Bearer ${validToken}`).send(body);
            expect(res.status).toBe(400);
            expect(mockSupabase.rpc).not.toHaveBeenCalled();
        });
    });

    describe('article and research credits', () => {
        const articleId = '11111111-1111-4111-8111-111111111111';
        const researchId = '22222222-2222-4222-8222-222222222222';

        it('consumes article access and treats a duplicate as already accessible', async () => {
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({ data: { success: true, remaining_credits: 2 }, error: null });
            let res = await request(app).post('/api/credits/consume-article').set('Authorization', `Bearer ${validToken}`).send({ article_id: articleId });
            expect(res.status).toBe(200);
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505' } });
            res = await request(app).post('/api/credits/consume-article').set('Authorization', `Bearer ${validToken}`).send({ article_id: articleId });
            expect(res.body).toMatchObject({ success: true, message: 'لديك صلاحية الوصول بالفعل' });
        });

        it('rejects malformed article ids and insufficient research credits', async () => {
            mockAuth();
            let res = await request(app).post('/api/credits/consume-article').set('Authorization', `Bearer ${validToken}`).send({ article_id: 'not-a-uuid' });
            expect(res.status).toBe(400);
            mockAuth();
            mockSupabase.rpc.mockResolvedValueOnce({ data: { success: false, message: 'رصيد غير كافي' }, error: null });
            res = await request(app).post('/api/credits/consume-research').set('Authorization', `Bearer ${validToken}`).send({ research_id: researchId });
            expect(res.body).toMatchObject({ code: 'CREDITS_INSUFFICIENT' });
        });
    });

    describe('public access checks', () => {
        const articleId = '11111111-1111-4111-8111-111111111111';
        const researchId = '22222222-2222-4222-8222-222222222222';

        it('shows that paid content requires authentication and validates ids', async () => {
            mockSupabase.single.mockResolvedValueOnce({ data: { credits_required: 3 }, error: null });
            let res = await request(app).get(`/api/credits/check-article-access/${articleId}`);
            expect(res.body).toMatchObject({ has_access: false, requires_auth: true });
            res = await request(app).get('/api/credits/check-research-access/not-a-uuid');
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation Error');
            expect(mockSupabase.single).toHaveBeenCalledTimes(1);
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

        it('rejects invalid pagination and transaction types', async () => {
            mockAuth();
            let res = await request(app).get('/api/credits/transactions?page=0').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(400);
            mockAuth();
            res = await request(app).get('/api/credits/transactions?limit=101&type=drop').set('Authorization', `Bearer ${validToken}`);
            expect(res.status).toBe(400);
        });
    });
});
