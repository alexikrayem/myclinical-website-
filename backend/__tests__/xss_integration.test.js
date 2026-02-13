import { jest } from '@jest/globals';
import supertest from 'supertest';

// Mock global fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// Stable Mocks
const mockAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'admin'
};

// Article Mocks
const mockInsertSelect = jest.fn().mockResolvedValue({ data: [{}], error: null });
const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect });
const mockArticleSelect = jest.fn().mockReturnValue({ insert: mockInsert });

const mockSupabase = {
    auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: mockAdmin, session: { access_token: 'valid-token' } },
            error: null
        })
    },
    from: jest.fn((table) => {
        if (table === 'admins') {
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
            };
        }
        if (table === 'articles') {
            return {
                select: mockArticleSelect,
                insert: mockInsert,
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis()
            };
        }
        return { select: jest.fn().mockReturnThis() };
    }),
    storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/image.jpg' } })
    }
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabase)
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    authLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next()
}));

// Mock authentication middleware to bypass check
jest.unstable_mockModule('../middleware/auth.js', () => ({
    authenticateToken: (req, res, next) => {
        req.user = mockAdmin;
        next();
    },
    trackLoginAttempt: jest.fn(),
    checkLoginAllowed: (req, res, next) => next()
}));

const { default: app } = await import('../server.js');

describe('XSS Protection Integration', () => {
    it('should sanitize article content on creation', async () => {
        const maliciousContent = '<h1>Title</h1><script>alert("xss")</script><p>Safe</p>';
        const expectedContent = '<h1>Title</h1><p>Safe</p>'; // sanitize-html removes script

        // Need to ensure sanitize-html behavior matches expectation from our config
        // In inputSanitizer.js, we allowed specific tags. <script> is not one of them.

        const res = await supertest(app)
            .post('/api/admin/articles')
            .field('title', 'Test Article XSS')
            .field('excerpt', 'Test Excerpt')
            .field('content', maliciousContent) // Send malicious HTML
            .field('author', 'Admin')
            .field('tags', '["test"]')
            .field('is_featured', 'false')
            .field('cover_image_url', 'http://example.com/image.jpg');

        expect(res.status).toBe(201);

        // Check the insert call arguments
        // mockInsert was defined outside, so we can check it
        expect(mockInsert).toHaveBeenCalled();

        const insertCall = mockInsert.mock.calls[0][0];
        // insertCall is an array of objects
        const insertedArticle = insertCall[0];

        // Use toContain because the sanitizer might format slightly differently (e.g. newlines)
        // But sanitizeAuth removes script fully.
        expect(insertedArticle.content).toContain('<h1>Title</h1>');
        expect(insertedArticle.content).toContain('<p>Safe</p>');
        expect(insertedArticle.content).not.toContain('<script>');
        expect(insertedArticle.content).not.toContain('alert("xss")');
    });
});
