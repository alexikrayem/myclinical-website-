import { jest } from '@jest/globals';
import supertest from 'supertest';

// Mock global fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// --- Mocks ---
const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'super_admin'
};

const mockSupabase = {
    auth: {
        getUser: jest.fn()
    },
    from: jest.fn(() => ({
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                single: jest.fn()
            }))
        }))
    }))
};

// Mock dependencies
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(null)) // No redis
}));

jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn(() => ({
        getGenerativeModel: jest.fn(() => ({
            generateContent: jest.fn(() => Promise.resolve({
                response: {
                    text: () => JSON.stringify({
                        title: "Mock AI Title",
                        excerpt: "Mock AI Excerpt",
                        content: "<p>Mock Content</p>",
                        tags: ["mock"],
                        author: "AI"
                    })
                }
            }))
        }))
    }))
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
}));

// Import app
const { default: app } = await import('../server.js');

describe('AI Generation Endpoint Security', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Default Supabase mock behavior (reset)
        mockSupabase.auth.getUser.mockReset();
        // Reset the chain for admin check
        mockSupabase.from.mockImplementation((table) => {
            if (table === 'admins') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({ data: mockAdminUser, error: null })
                        }))
                    }))
                };
            }
            return {
                select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) }))
            };
        });
    });

    describe('POST /api/articles/generate-article', () => {
        it('should return 401 if no Authorization header is present', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .send({ text: 'Some medical text' });

            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/Authentication token is required/);
        });

        it('should return 403 if token is invalid', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: { message: 'Invalid token' }
            });

            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .set('Authorization', 'Bearer invalid-token')
                .send({ text: 'Some medical text' });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/Invalid or expired token/);
        });

        it('should return 403 if user is not an admin', async () => {
            // Valid user but not admin
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: 'regular-user-id' } },
                error: null
            });

            // Mock admin check to fail
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'admins') {
                    return {
                        select: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
                            }))
                        }))
                    };
                }
                return { select: jest.fn() };
            });

            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .set('Authorization', 'Bearer user-token')
                .send({ text: 'Some medical text' });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/Access denied/);
        });

        it('should return 200 if user is admin and request is valid', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: mockAdminUser.id } },
                error: null
            });

            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .set('Authorization', 'Bearer admin-token')
                .send({ text: 'Some medical text' });

            expect(res.status).toBe(200);
            expect(res.body.title).toBe("Mock AI Title");
        });
    });

    describe('POST /api/articles/generate-article-from-file', () => {
        it('should return 401 if no Authorization header', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article-from-file');
            // No file needed for auth check usually, but might fail validation first if middleware order matters.
            // In the code, authenticateToken comes BEFORE validateUploadedFile (wait, check the order I put)

            expect(res.status).toBe(401);
        });
    });
});
