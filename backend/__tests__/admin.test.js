
import { jest } from '@jest/globals';

// --- Mocks Setup ---
const createSupabaseMock = () => {
    const builder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        single: jest.fn(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        auth: {
            signUp: jest.fn(),
            signInWithPassword: jest.fn(),
            getUser: jest.fn()
        },
        storage: {
            from: jest.fn().mockReturnThis(),
            upload: jest.fn(),
            getPublicUrl: jest.fn()
        },
        // Make the builder itself waitable
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

// Mock rate limiters
jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    limiters: {}
}));

// Mock cache
jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
}));

// Mock jsonwebtoken
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn((token, secret) => {
            if (token === 'valid-admin-token') return { userId: 'admin-123', role: 'admin' };
            throw new Error('Invalid token');
        }),
        sign: jest.fn(() => 'valid-admin-token')
    },
    verify: jest.fn((token, secret) => {
        if (token === 'valid-admin-token') return { userId: 'admin-123', role: 'admin' };
        throw new Error('Invalid token');
    }),
    sign: jest.fn(() => 'valid-admin-token')
}));

// Dynamic import after mocks
const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Admin Routes Integration Tests', () => {
    const adminUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: 'admin'
    };
    const validToken = 'valid-admin-token';

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.insert.mockReturnThis();
        mockSupabase.update.mockReturnThis();
        mockSupabase.delete.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.order.mockReturnThis();
        mockSupabase.limit.mockReturnThis();
        mockSupabase.single.mockReset();
    });

    describe('POST /api/admin/login', () => {
        it('should login successfully with correct credentials', async () => {
            // Mock signInWithPassword
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: { id: adminUser.id, email: adminUser.email },
                    session: { access_token: validToken, expires_at: 1234567890 }
                },
                error: null
            });

            // Mock admin check
            mockSupabase.single.mockResolvedValue({
                data: adminUser,
                error: null
            });

            const res = await request(app)
                .post('/api/admin/login')
                .send({ email: 'admin@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('session');
            expect(res.body.user.role).toBe('admin');
        });

        it('should fail if not an admin', async () => {
            // Mock signInWithPassword success
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: {
                    user: { id: 'user-123', email: 'user@example.com' },
                    session: { access_token: 'user-token' }
                },
                error: null
            });

            // Mock admin check to return null (not found in admins table)
            mockSupabase.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' }
            });

            const res = await request(app)
                .post('/api/admin/login')
                .send({ email: 'user@example.com', password: 'password123' });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('NOT_ADMIN');
        });
    });

    describe('POST /api/admin/articles', () => {
        it('should create a new article', async () => {
            // Mock auth: getUser (called by authenticateToken)
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: adminUser },
                error: null
            });

            // Mock admin check: single (called by authenticateToken)
            mockSupabase.single.mockResolvedValueOnce({
                data: adminUser,
                error: null
            });

            // Mock article insert: then (called by route handler for insert().select())
            mockSupabase.insert.mockReturnThis();
            mockSupabase.select.mockReturnThis();
            mockSupabase.then = jest.fn((resolve) => resolve({ data: [{ id: 'article-1', title: 'New Article' }], error: null }));

            // NOTE: Since the route handles file upload to Supabase, we should mock that if we send a file.
            // But for simplicity, we can test validation or send a JSON body with `cover_image_url` to bypass file upload.

            const articleData = {
                title: 'New Article Title',
                excerpt: 'This is a short excerpt for the article.',
                content: '<p>Content</p>',
                author: 'Admin',
                tags: '["health", "news"]', // Sent as string/multipart usually, but JSON body works if no file
                is_featured: 'true',
                cover_image_url: 'http://example.com/image.jpg'
            };

            const res = await request(app)
                .post('/api/admin/articles')
                .set('Authorization', `Bearer ${validToken}`)
                .send(articleData);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id', 'article-1');
        });
    });
});
