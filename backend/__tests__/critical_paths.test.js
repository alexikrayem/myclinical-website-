import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs'; // Import bcrypt to mock it

// --- Mocks Setup ---
// Create a recursive thenable mock to handle Supabase chaining (e.g. await query.eq())
const createSupabaseMock = () => {
    const builder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
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
        auth: {
            signUp: jest.fn(),
            signInWithPassword: jest.fn(),
            getUser: jest.fn()
        },
        // Make the builder itself waitable
        then: function (resolve, reject) {
            // Default resolution if await is called directly on chain
            // This handles cases like `await supabase.from('table').insert(...)`
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

// Mock rate limiters to skip them
jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    apiLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next(),
    limiters: {}
}));

// Mock cache middleware
jest.unstable_mockModule('../middleware/cache.js', () => ({
    cacheMiddleware: () => (req, res, next) => next()
}));

// Mock bcryptjs
jest.unstable_mockModule('bcryptjs', () => {
    const mockHash = jest.fn((password, saltRounds) => Promise.resolve(`hashed_${password}_${saltRounds}`));
    const mockCompare = jest.fn((password, hash) => Promise.resolve(hash === `hashed_${password}_10`));

    return {
        default: {
            hash: mockHash,
            compare: mockCompare
        },
        hash: mockHash,
        compare: mockCompare
    };
});

// Mock jsonwebtoken
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn((token, secret) => {
            if (token === 'valid-jwt-token') return { userId: 'user-123', type: 'user' };
            throw new Error('Invalid token');
        }),
        sign: jest.fn(() => 'valid-jwt-token')
    },
    verify: jest.fn((token, secret) => {
        if (token === 'valid-jwt-token') return { userId: 'user-123', type: 'user' };
        throw new Error('Invalid token'); // Simulate JsonWebTokenError? Or just Error.
    }),
    sign: jest.fn(() => 'valid-jwt-token')
}));


// Dynamic import after mocks
const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Critical Paths Integration Tests (Mocked)', () => {
    const testUser = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
    };
    const validToken = 'valid-jwt-token';
    const testUserId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset basic mocks
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.insert.mockReturnThis();
        mockSupabase.update.mockReturnThis();
        mockSupabase.eq.mockReturnThis();
        mockSupabase.order.mockReturnThis();
        mockSupabase.limit.mockReturnThis();
        mockSupabase.range.mockReturnThis();
        mockSupabase.contains.mockReturnThis();
        mockSupabase.or.mockReturnThis();
        // Ensure thenable logic is clean if needed, mostly static
    });

    describe('1. Authentication Flow', () => {
        it('should register a new user', async () => {
            // signUp
            mockSupabase.auth.signUp.mockResolvedValue({
                data: { user: { id: testUserId, email: testUser.email } },
                error: null
            });

            // 1. check phone exists: .select('id').eq(...).single()
            mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // No existing user

            // 2. insert user: .insert(...).select(...).single()
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: testUserId, phone_number: '0912345678', display_name: 'Test' },
                error: null
            });

            // 3. insert credits: .insert(...) -> awaited directly (using thenable)
            // No .single() call here.
            // FIX: await expects then(resolve, reject) to call resolve!
            mockSupabase.then = jest.fn();
            mockSupabase.then.mockImplementationOnce((resolve) => resolve({ data: {}, error: null })); // For credits insert

            // 4. createSession -> .insert(...).select().single()
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'session-123', token_hash: 'hash' },
                error: null
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...testUser, phone_number: '0912345678' });

            if (res.status === 500) console.error(res.body);
            expect(res.status).toBeOneOf([200, 201]);
            expect(res.body).toHaveProperty('token');
        });

        it('should login', async () => {
            // 1. find user: .select('*').eq(...).single()
            mockSupabase.single.mockResolvedValueOnce({
                data: {
                    id: testUserId,
                    phone_number: '0912345678',
                    password_hash: `hashed_${testUser.password}_10`, // Mocked hash for 'Password123!'
                    is_active: true
                },
                error: null
            });

            // 2. create session: insert...
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'session-123' },
                error: null
            });

            // 3. update last login: .update(...).eq(...) -> awaited.
            mockSupabase.then.mockImplementationOnce((resolve) => resolve({ data: {}, error: null })); // For update

            // Mock auth verify should succeed because we mocked jwt.verify

            // Mock signIn success (unused by login route but kept for completeness of test intention)
            mockSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { session: { access_token: validToken }, user: { id: testUserId } },
                error: null
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ ...testUser, phone_number: '0912345678' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token', validToken);
        });

        it('should get profile', async () => {
            // Mock auth verification
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: { id: testUserId } },
                error: null
            });

            // Mock profile fetch: .select('*').eq(...).single()
            // 1. authenticateUser middleware: check session
            mockSupabase.single.mockResolvedValueOnce({
                data: {
                    id: 'session-123',
                    users: {
                        id: testUserId,
                        phone_number: '0912345678',
                        display_name: 'Test',
                        is_active: true,
                        created_at: new Date().toISOString()
                    }
                },
                error: null
            });
            // 2. profile route: check credits
            mockSupabase.single.mockResolvedValueOnce({
                data: {
                    balance: 0,
                    video_watch_minutes: 0,
                    article_credits: 0,
                    total_earned: 0,
                    total_spent: 0
                },
                error: null
            });

            const res = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            // userAuth.js returns { user: { ... }, credits: ... }
            expect(res.body.user).toHaveProperty('phone_number'); // Since userAuth.js returns mapped user object
        });
    });

    describe('2. Articles Access', () => {
        it('should list articles', async () => {
            const articles = [{ id: 'a1', title: 'Test Article' }];
            // Mock the final resolution of the query chain for articles
            // This handles .select(..., { count: 'exact' })... .range(...)
            // The `then` method on the builder will be called when `await` is used on the chain.
            mockSupabase.then = jest.fn((resolve) => resolve({ data: articles, count: 1, error: null }));

            const res = await request(app).get('/api/articles');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0]).toEqual(articles[0]);
            // expect(res.body.count).toBe(1); // REMOVED: API returns count in pagination.total
            expect(res.body.pagination.total).toBe(1);
        });
    });
});

// Helper
expect.extend({
    toBeOneOf(received, expected) {
        const pass = expected.includes(received);
        return {
            message: () => `expected ${received} to be one of ${expected}`,
            pass: pass,
        };
    },
});
