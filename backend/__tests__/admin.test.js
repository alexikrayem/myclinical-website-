import { jest } from '@jest/globals';
import { mockSupabase, resetSupabaseMock } from './mocks/supabaseMock.js';
import { mockRedis } from './mocks/redisMock.js';
import { mockRateLimiters, mockCache } from './mocks/middlewareMock.js';

// --- Mocks Setup ---
jest.unstable_mockModule('../config/supabase.js', () => ({
    supabaseAdmin: mockSupabase,
    supabasePublic: mockSupabase
}));

jest.unstable_mockModule('../config/redis.js', () => ({
    getRedisClient: jest.fn(() => Promise.resolve(mockRedis)),
    isRedisAvailable: jest.fn(() => true)
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => mockRateLimiters);
jest.unstable_mockModule('../middleware/cache.js', () => mockCache);

export const mockLogger = {
    info: jest.fn(),
    error: jest.fn((...args) => console.log('LOGGER ERROR:', ...args)),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
};
jest.unstable_mockModule('../config/logger.js', () => ({
    default: mockLogger
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
        resetSupabaseMock();
        jest.clearAllMocks();
    });

    describe('POST /api/admin/login', () => {
        it('should login successfully with correct credentials', async () => {
            mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
                data: {
                    user: { id: adminUser.id, email: adminUser.email },
                    session: { access_token: validToken, expires_at: 1234567890 }
                },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
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
            mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
                data: {
                    user: { id: 'user-123', email: 'user@example.com' },
                    session: { access_token: 'user-token' }
                },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
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
            mockSupabase.auth.getUser.mockImplementation((token) => {
                if (token === validToken) return Promise.resolve({ data: { user: adminUser }, error: null });
                return Promise.resolve({ data: { user: null }, error: new Error('Invalid token') });
            });

            mockSupabase.single.mockImplementation(() => {
                // Return admin info for auth check
                return Promise.resolve({ data: adminUser, error: null });
            });

            // For the insert call, we don't use single() in the route handler, we use a chain ending in select().
            // Our mock handles then() by returning {} by default. 
            // We can override the results.
            mockSupabase._results = { data: [{ id: 'article-1', title: 'New Article Title' }], error: null };

            const articleData = {
                title: 'New Article Title',
                excerpt: 'This is a short excerpt for the article.',
                content: '<p>Content</p>',
                author: 'Admin',
                tags: '["health", "news"]',
                is_featured: 'true',
                cover_image_url: 'http://example.com/image.jpg'
            };

            const res = await request(app)
                .post('/api/admin/articles')
                .set('Authorization', `Bearer ${validToken}`)
                .send(articleData);

            console.log('RESPONSE STATUS:', res.status, 'BODY:', res.body);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id', 'article-1');
        });
    });
});
