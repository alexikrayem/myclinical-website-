
import { jest } from '@jest/globals';
import { request } from 'express';

// --- Mocks Setup ---
const createSupabaseMock = () => {
    const builder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: function (resolve, reject) {
            resolve({ data: [], count: 0, error: null });
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
    limiters: {},
    redeemLimiter: (req, res, next) => next(),
    accountRedeemLimiter: (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next(),
    invalidateCache: jest.fn(),
    invalidateCachePattern: jest.fn()
}));

jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: class {
        getGenerativeModel() { return {}; }
    }
}));

// Mock pdf-parse
jest.unstable_mockModule('pdf-parse', () => ({
    default: jest.fn()
}));

// Import App 
const { default: supertest } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Security Exposure Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
    });

    describe('GET /api/articles', () => {
        it('should return articles listing successfully', async () => {
            const article = {
                id: 'a1',
                title: 'Test Article',
                excerpt: 'Public Excerpt'
            };

            // Supabase promise mock
            mockSupabase.then = jest.fn((resolve) => resolve({
                data: [article],
                count: 1,
                error: null
            }));

            const res = await supertest(app).get('/api/articles');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toBe('a1');
            expect(res.body.data[0].title).toBe('Test Article');
        });
    });

    describe('GET /api/courses', () => {
        it('should correctly select fields to exclude playback_source', async () => {
            // Mock response
            mockSupabase.then = jest.fn((resolve) => resolve({
                data: [{ id: 'c1', title: 'Course 1' }],
                count: 1,
                error: null
            }));

            const res = await supertest(app).get('/api/courses');
            expect(res.statusCode).toEqual(200);

            // Verify the select call does NOT include sensitive fields
            const selectCall = mockSupabase.select.mock.calls.find(call => typeof call[0] === 'string');
            const selectArgs = selectCall[0];

            expect(selectArgs).toContain('id');
            expect(selectArgs).not.toContain('*');
            expect(selectArgs).not.toContain('playback_source');
            expect(selectArgs).not.toContain('transcript');
        });
    });

    describe('GET /api/research', () => {
        it('should correctly select fields to exclude file_url', async () => {
            // Mock response
            mockSupabase.then = jest.fn((resolve) => resolve({
                data: [{ id: 'r1', title: 'Research 1' }],
                count: 1,
                error: null
            }));

            const res = await supertest(app).get('/api/research');
            expect(res.statusCode).toEqual(200);

            // Verify the select call
            const selectCall = mockSupabase.select.mock.calls.find(call => typeof call[0] === 'string');
            const selectArgs = selectCall[0];

            expect(selectArgs).toContain('id');
            expect(selectArgs).not.toContain('*');
            expect(selectArgs).not.toContain('file_url');
        });
    });
});
