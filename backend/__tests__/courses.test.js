
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

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
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
                id: 'c1',
                title: 'Course 1',
                video_url: 'secret-video',
                transcript: 'secret-text',
                price: 100
            };

            // 1. Fetch course
            mockSupabase.single.mockResolvedValueOnce({ data: course, error: null });

            // 2. Check access (for authenticated user - but let's test public first)
            // Wait, route uses optionalAuth. If we don't send token, req.user is null.
            // If req.user is null, hasAccess = false.

            const res = await request(app).get('/api/courses/c1');

            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Course 1');
            expect(res.body).not.toHaveProperty('video_url');
            expect(res.body).not.toHaveProperty('transcript');
            expect(res.body.has_access).toBe(false);
        });

        it('should return full info if purchased', async () => {
            const course = {
                id: 'c1',
                title: 'Course 1',
                video_url: 'secret-video',
                transcript: 'secret-text'
            };

            // 1. Check access (mocking existing access)
            // auth user lookup in optionalAuth -> check supabase users table
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', is_active: true },
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
                .get('/api/courses/c1')
                .set('Authorization', `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body.video_url).toBe('secret-video');
            expect(res.body.has_access).toBe(true);
        });
    });
});
