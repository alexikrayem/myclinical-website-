import { jest } from '@jest/globals';
import { NotFoundError, AppError } from '../../utils/errors.js';

jest.unstable_mockModule('../../services/courses/courseCatalogService.js', () => ({
    getPublicCourseById: jest.fn()
}));

const courseAccessService = await import('../../services/courses/courseAccessService.js');
const catalogService = await import('../../services/courses/courseCatalogService.js');

describe('courseAccessService Unit Tests', () => {
    let mockSupabaseAdmin;
    let mockSupabasePublic;

    beforeEach(() => {
        mockSupabaseAdmin = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            single: jest.fn(),
        };
        mockSupabasePublic = {};

        // Reset the mock implementations directly if needed, or leave to beforeEach
        catalogService.getPublicCourseById.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getCourseAccessDetails', () => {
        const payload = {
            supabasePublic: {},
            supabaseAdmin: {},
            courseId: 'c1',
            user: null
        };

        it('should throw NotFoundError if course does not exist', async () => {
            catalogService.getPublicCourseById.mockResolvedValueOnce(null);

            await expect(courseAccessService.getCourseAccessDetails(payload))
                .rejects.toThrow(NotFoundError);
        });

        it('should return has_access=true for per_minute course without auth but requires_auth=true', async () => {
            catalogService.getPublicCourseById.mockResolvedValueOnce({
                id: 'c1',
                billing_model: 'per_minute'
            });

            const result = await courseAccessService.getCourseAccessDetails(payload);
            expect(result.has_access).toBe(false); // Wait, !user => hasAccess = false
            expect(result.requires_auth).toBe(true);
        });

        it('should fetch course_access correctly if billing_model=per_course and user is authenticated', async () => {
            catalogService.getPublicCourseById.mockResolvedValueOnce({
                id: 'c1',
                billing_model: 'per_course'
            });

            payload.supabaseAdmin = mockSupabaseAdmin;
            payload.user = { id: 'u1' };

            mockSupabaseAdmin.single.mockResolvedValueOnce({ data: { id: 'access_1' }, error: null });

            const result = await courseAccessService.getCourseAccessDetails(payload);
            expect(result.has_access).toBe(true);
            expect(result.requires_auth).toBe(false);
            expect(mockSupabaseAdmin.eq).toHaveBeenCalledWith('custom_user_id', 'u1');
        });

        it('should throw AppError if fetching course_access fails unexpectedly', async () => {
            catalogService.getPublicCourseById.mockResolvedValueOnce({
                id: 'c1',
                billing_model: 'per_course'
            });

            payload.supabaseAdmin = mockSupabaseAdmin;
            payload.user = { id: 'u1' };

            mockSupabaseAdmin.single.mockResolvedValueOnce({ data: null, error: { code: 'UNKNOWN' } });

            await expect(courseAccessService.getCourseAccessDetails(payload))
                .rejects.toMatchObject({ statusCode: 500, code: 'COURSE_ACCESS_FAILED' });
        });

        it('should fetch typed credits when no basic access is granted', async () => {
            // Mock course returned
            catalogService.getPublicCourseById.mockResolvedValueOnce({
                id: 'c1',
                billing_model: 'per_course' // Meaning hasAccess = false initially
            });

            payload.supabaseAdmin = mockSupabaseAdmin;
            payload.user = { id: 'u1' };

            // First single() call is for `course_access` row
            mockSupabaseAdmin.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

            // Next queries are for typed credits inside `getApplicableTypedCredits`:

            // 1. fetch main credits
            // Let's implement a rudimentary sequence or just mock the chain properly.
            // But from().select().eq() is heavily chained. A simpler way is returning an object wrapper.
            const mockCreditsData = {
                data: [{ credit_type_id: 1, balance: 10, credit_types: { name: 'Test', prefix: 'T' } }]
            };
            const mockLinkedTypes = {
                data: [{ credit_type_id: 1 }]
            };

            // Using mockResolvedValue Once sequentially for the final await points (which is just the query result)
            // It relies on .in() returning the query object which we await.
            // Just returning valid mocks:
            // Second await ends with .gt()
            mockSupabaseAdmin.gt.mockResolvedValueOnce(mockCreditsData);

            // Third await ends with .eq(). We'll intercept .in() to supply the promise at the end.
            const mockInQuery = { eq: jest.fn().mockResolvedValue(mockLinkedTypes) };
            mockSupabaseAdmin.in.mockReturnValueOnce(mockInQuery);

            const result = await courseAccessService.getCourseAccessDetails(payload);
            expect(result.has_access).toBe(false);

            // We should expect typed credits
            expect(result.applicable_typed_credits).toBeDefined();
            // Length based on the mocks resolving
        });
    });
});
