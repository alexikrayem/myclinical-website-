import { jest } from '@jest/globals';
import { AppError } from '../../utils/errors.js';
import * as courseBillingService from '../../services/courses/courseBillingService.js';

describe('courseBillingService Unit Tests', () => {
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = {
            rpc: jest.fn()
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('consumePlaybackHeartbeat', () => {
        const defaultPayload = {
            supabase: null,
            sessionId: 'sess123',
            secondsDelta: 65,
            idempotencyKey: 'idemp_abc',
            customUserId: 'u1'
        };

        it('should successfully consume positive seconds and return data', async () => {
            const payload = { ...defaultPayload, supabase: mockSupabase };
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: true },
                error: null
            });

            const result = await courseBillingService.consumePlaybackHeartbeat(payload);
            expect(result.success).toBe(true);
            expect(mockSupabase.rpc).toHaveBeenCalledWith(
                'consume_video_minutes_v2',
                expect.objectContaining({
                    p_session_id: 'sess123',
                    p_seconds: 65,
                    p_idempotency_key: 'idemp_abc',
                    p_custom_user_id: 'u1'
                })
            );
        });

        it('should strictly floor seconds correctly and ensure a non-negative value', async () => {
            const payload = { ...defaultPayload, supabase: mockSupabase, secondsDelta: -10 };
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: true },
                error: null
            });

            await courseBillingService.consumePlaybackHeartbeat(payload);
            expect(mockSupabase.rpc).toHaveBeenCalledWith(
                'consume_video_minutes_v2',
                expect.objectContaining({
                    p_seconds: 0
                })
            );
        });

        it('should throw AppError if RPC fails', async () => {
            const payload = { ...defaultPayload, supabase: mockSupabase };
            mockSupabase.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'DB execution fail' }
            });

            await expect(courseBillingService.consumePlaybackHeartbeat(payload))
                .rejects.toThrow(AppError);

            await expect(courseBillingService.consumePlaybackHeartbeat({ ...payload, supabase: { rpc: jest.fn().mockResolvedValue({ error: {} }) } }))
                .rejects.toMatchObject({ code: 'BILLING_HEARTBEAT_FAILED', statusCode: 500 });
        });
    });
});
