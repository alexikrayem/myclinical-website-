import { jest } from '@jest/globals';
import { AppError, BadRequestError } from '../../utils/errors.js';
import * as coursePurchaseService from '../../services/courses/coursePurchaseService.js';

describe('coursePurchaseService Unit Tests', () => {
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = {
            rpc: jest.fn()
        };
    });

    describe('purchaseCourseAccess', () => {
        const payload = { courseId: 'c1', userId: 'u1', idempotencyKey: 'idemp-123' };

        it('should successfully parse a valid purchase', async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, message: 'Purchased' },
                error: null
            });

            const result = await coursePurchaseService.purchaseCourseAccess(mockSupabase, payload);
            expect(result.success).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledWith('purchase_course_access', {
                p_course_id: 'c1',
                p_user_id: 'u1',
                p_idempotency_key: 'idemp-123'
            });
        });

        it('should throw AppError on RPC technical failure', async () => {
            const error = new Error('RPC Execution failed');
            mockSupabase.rpc.mockResolvedValue({ data: null, error });

            await expect(coursePurchaseService.purchaseCourseAccess(mockSupabase, payload))
                .rejects.toMatchObject({ statusCode: 500, code: 'COURSE_PURCHASE_FAILED' });
        });

        it('should throw BadRequestError on logical failure (e.g., insufficient balance)', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: false, message: 'Insufficient balance' },
                error: null
            });

            await expect(coursePurchaseService.purchaseCourseAccess(mockSupabase, payload))
                .rejects.toMatchObject({ message: 'Insufficient balance', statusCode: 400 });
        });
    });
});
