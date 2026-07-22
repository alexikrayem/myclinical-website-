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

const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn()
};

// Mock dependencies
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    isRedisAvailable: jest.fn(() => true)
}));

jest.unstable_mockModule('../config/gemini.js', () => ({
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
    })),
    default: jest.fn(() => ({}))
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next(),
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

// Import app
const { default: app } = await import('../server.js');

describe('AI Generation Endpoint Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/articles/generate-article', () => {
        // NOTE: This route uses aiLimiter but does NOT require authenticateToken.
        // It is a public AI endpoint with rate limiting.

        it('should return 200 with valid text input', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .send({ text: 'Some medical text about dental health' });

            expect(res.status).toBe(200);
            expect(res.body.title).toBe("Mock AI Title");
            expect(res.body.excerpt).toBe("Mock AI Excerpt");
            expect(res.body.author).toBe("AI");
        });

        it('should return 400 if text is missing', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('should return 400 if text is empty', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .send({ text: '' });

            expect(res.status).toBe(400);
        });

        it('should accept optional language parameter', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .send({ text: 'Some medical text', language: 'english' });

            expect(res.status).toBe(200);
        });

        it('should reject invalid language parameter', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article')
                .send({ text: 'Some medical text', language: 'french' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/articles/generate-article-from-file', () => {
        // NOTE: This route expects a file upload (req.file).
        // Without a file, it will fail at req.file.path

        it('should return 500 if no file is uploaded (no req.file)', async () => {
            const res = await supertest(app)
                .post('/api/articles/generate-article-from-file');

            // Without a file, req.file is undefined, causing an error
            expect(res.status).toBe(500);
        });
    });
});
