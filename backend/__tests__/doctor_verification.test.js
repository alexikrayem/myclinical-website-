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


// Mock jsonwebtoken for admin and user auth
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn((token, secret) => {
            if (token === 'valid-admin-token') return { userId: 'admin-123', role: 'admin' };
            if (token === 'valid-user-token') return { userId: 'doctor-123' };
            throw new Error('Invalid token');
        }),
        sign: jest.fn(() => 'valid-token')
    },
    verify: jest.fn((token, secret) => {
        if (token === 'valid-admin-token') return { userId: 'admin-123', role: 'admin' };
        if (token === 'valid-user-token') return { userId: 'doctor-123' };
        throw new Error('Invalid token');
    }),
    sign: jest.fn(() => 'valid-token')
}));

// Dynamic imports after mocks
const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');

describe('Doctor Registration & Admin Verification Flow', () => {
    const adminToken = 'valid-admin-token';
    const doctorId = 'doctor-123';

    beforeEach(() => {
        resetSupabaseMock();
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register-doctor', () => {
        it('should fail if required fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/register-doctor')
                .field('phone_number', '0912345678')
                .field('password', 'Pass12345!');

            expect(res.status).toBe(400);
            // Joi validation errors return an `error` string (no top-level `code`)
            expect(res.body).toHaveProperty('error');
        });

        it('should fail if syndicate card file is missing', async () => {
            const res = await request(app)
                .post('/api/auth/register-doctor')
                .field('phone_number', '0912345678')
                .field('password', 'Pass12345!')
                .field('display_name', 'د. خالد')
                .field('specialization', 'تقويم الأسنان')
                .field('bio', 'طبيب أسنان مختص')
                .field('education', 'دكتوراه تقويم')
                .field('experience_years', 5)
                .field('clinic_address', 'دمشق');

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('MISSING_CARD_FILE');
        });

        it('should fail if file is not a valid image (invalid signature)', async () => {
            const res = await request(app)
                .post('/api/auth/register-doctor')
                .field('phone_number', '0912345678')
                .field('password', 'Pass12345!')
                .field('display_name', 'د. خالد')
                .field('specialization', 'تقويم الأسنان')
                .field('bio', 'طبيب أسنان مختص')
                .field('education', 'دكتوراه تقويم')
                .field('experience_years', 5)
                .field('clinic_address', 'دمشق')
                .attach('syndicate_card', Buffer.from('not-an-image'), 'card.txt');

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
        });

        it('should register doctor successfully if all inputs and card file signature are valid', async () => {
            // Valid 1x1 pixel transparent PNG
            const mockPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

            mockSupabase.single.mockResolvedValueOnce({
                data: null, // Phone doesn't exist
                error: null
            });

            mockSupabase.maybeSingle.mockResolvedValueOnce({
                data: null, // Author name doesn't exist
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: {
                    id: doctorId,
                    phone_number: '0912345678',
                    display_name: 'د. خالد',
                    role: 'doctor',
                    verification_status: 'pending'
                },
                error: null
            });

            const res = await request(app)
                .post('/api/auth/register-doctor')
                .field('phone_number', '0912345678')
                .field('password', 'Pass12345!')
                .field('display_name', 'د. خالد')
                .field('specialization', 'تقويم الأسنان')
                .field('bio', 'طبيب أسنان مختص')
                .field('education', 'دكتوراه تقويم')
                .field('experience_years', 5)
                .field('clinic_address', 'دمشق')
                .attach('syndicate_card', mockPngBuffer, 'card.png');

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.user.verification_status).toBe('pending');
            expect(res.body.user.role).toBe('doctor');
            // Token is now an httpOnly cookie, not in the response body
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(c => c.startsWith('user_session='))).toBe(true);
        });
    });

    describe('Admin Verifications API', () => {
        it('GET /api/admin/verifications should list pending verifications', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: 'admin-123' } },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'admin-123', role: 'admin' },
                error: null
            });

            mockSupabase.order.mockResolvedValueOnce({
                data: [
                    {
                        id: doctorId,
                        display_name: 'د. خالد',
                        role: 'doctor',
                        verification_status: 'pending'
                    }
                ],
                error: null
            });

            const res = await request(app)
                .get('/api/admin/verifications')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].display_name).toBe('د. خالد');
        });

        it('GET /api/admin/verifications/:id/card should return a signed URL', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: 'admin-123' } },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'admin-123', role: 'admin' },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: { syndicate_card_url: 'filename.png' },
                error: null
            });

            const res = await request(app)
                .get(`/api/admin/verifications/${doctorId}/card`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('signedUrl');
        });

        it('POST /api/admin/verifications/:id/approve should approve request and create author profile', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: 'admin-123' } },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'admin-123', role: 'admin' },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: {
                    id: doctorId,
                    display_name: 'د. خالد',
                    verification_status: 'pending',
                    specialization: 'تقويم الاسنان',
                    bio: 'مختص تقويم',
                    education: 'بكالوريوس',
                    experience_years: 5,
                    clinic_address: 'دمشق'
                },
                error: null
            });

            // check for existing author by user_id
            mockSupabase.maybeSingle.mockResolvedValueOnce({
                data: null,
                error: null
            });

            // check for existing author by name
            mockSupabase.maybeSingle.mockResolvedValueOnce({
                data: null,
                error: null
            });

            const res = await request(app)
                .post(`/api/admin/verifications/${doctorId}/approve`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('POST /api/admin/verifications/:id/reject should reject request with reason', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: 'admin-123' } },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'admin-123', role: 'admin' },
                error: null
            });

            mockSupabase.single.mockResolvedValueOnce({
                data: {
                    id: doctorId,
                    verification_status: 'pending'
                },
                error: null
            });

            const res = await request(app)
                .post(`/api/admin/verifications/${doctorId}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ rejection_reason: 'الصورة غير واضحة' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
