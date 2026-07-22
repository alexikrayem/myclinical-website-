
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
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        rpc: jest.fn(),
        then: function (resolve, reject) {
            resolve({ data: {}, error: null });
        }
    };
    return builder;
};

const mockSupabase = createSupabaseMock();
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn()
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    isRedisAvailable: jest.fn(() => true)
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    limiters: {},
    redeemLimiter: (req, res, next) => next(),
    accountRedeemLimiter: (req, res, next) => next(),
    consumeLimiter: (req, res, next) => next(),
    playbackLimiter: (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next(),
    invalidateCache: jest.fn(),
    invalidateCachePattern: jest.fn()
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

describe('Courses Routes Integration Tests', () => {
    const validToken = 'valid-token';
    const validCourseId = '11111111-1111-4111-8111-111111111111';

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.single.mockReset();
    });

    describe('GET /api/courses', () => {
        it('should list courses with pagination', async () => {
            const courses = [{ id: 'c1', title: 'Course 1' }];
            // Mock the list query
            mockSupabase.then = jest.fn((resolve) => resolve({ data: courses, count: 1, error: null }));

            const res = await request(app).get('/api/courses');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination.total).toBe(1);
        });
    });

    describe('GET /api/courses/:id', () => {
        it('should return public info if not purchased', async () => {
            const course = {
                id: validCourseId,
                title: 'Course 1',
                billing_model: 'per_course',
                credits_required: 100
            };

            // 1. Fetch course
            mockSupabase.single.mockResolvedValueOnce({ data: course, error: null });

            // 2. Check access (for authenticated user - but let's test public first)
            // Wait, route uses optionalAuth. If we don't send token, req.user is null.
            // If req.user is null, hasAccess = false.

            const res = await request(app).get(`/api/courses/${validCourseId}`);

            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Course 1');
            expect(res.body).not.toHaveProperty('playback_source');
            expect(res.body).not.toHaveProperty('transcript');
            expect(res.body.has_access).toBe(false);
        });

        it('should return full info if purchased', async () => {
            const course = {
                id: validCourseId,
                title: 'Course 1',
                billing_model: 'per_course',
                credits_required: 100
            };

            // 1. optionalAuth validates the active user session before adding req.user.
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
                error: null
            });

            // 2. Fetch course
            mockSupabase.single.mockResolvedValueOnce({ data: course, error: null });

            // 3. Check access table
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'access-1' },
                error: null
            });

            const res = await request(app)
                .get(`/api/courses/${validCourseId}`)
                .set('Authorization', `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body).not.toHaveProperty('playback_source');
            expect(res.body.has_access).toBe(true);
        });
    });

    describe('POST /api/courses/:id/access', () => {
        const payload = { idempotency_key: 'idemp-1234' };

        beforeEach(() => {
            // Mock Auth for optional endpoints
            mockSupabase.single.mockResolvedValue({
                data: { id: 'session-1', users: { id: 'user-123', is_active: true } },
                error: null
            });
        });

        it('should handle concurrent purchase requests using idempotency safely', async () => {
            // Mock RPC success
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, message: 'تم شراء الكورس بنجاح' },
                error: null
            });

            const requests = [
                request(app).post(`/api/courses/${validCourseId}/access`).set('Authorization', `Bearer ${validToken}`).send(payload),
                request(app).post(`/api/courses/${validCourseId}/access`).set('Authorization', `Bearer ${validToken}`).send(payload)
            ];

            const results = await Promise.all(requests);

            // Should both return success 200 without charging twice
            expect(results[0].status).toBe(200);
            expect(results[1].status).toBe(200);
            expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
        });

        it('should return 400 when insufficient credits during purchase', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: false, message: 'رصيد غير كافي' },
                error: null
            });

            const res = await request(app)
                .post(`/api/courses/${validCourseId}/access`)
                .set('Authorization', `Bearer ${validToken}`)
                .send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('رصيد غير كافي');
        });
    });
});
