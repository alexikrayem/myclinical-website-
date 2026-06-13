import { jest } from '@jest/globals';
import { AppError } from '../../utils/errors.js';
import * as creditsService from '../../services/credits/creditsService.js';

describe('creditsService Unit Tests', () => {
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            single: jest.fn(),
            rpc: jest.fn()
        };
    });

    describe('consumeArticleCredit', () => {
        const payload = { userId: 'u1', articleId: 'a1' };

        it('should handle unique constraint violation (23505) gracefully', async () => {
            const error = new Error('Database Error');
            error.code = '23505'; // Unique constraint violation

            mockSupabase.rpc.mockResolvedValue({ data: null, error });

            const result = await creditsService.consumeArticleCredit(mockSupabase, payload);
            expect(result.success).toBe(true);
            expect(result.message).toBe('لديك صلاحية الوصول بالفعل');
        });

        it('should throw AppError on general database failure', async () => {
            const error = new Error('Database Error');
            error.code = 'UNKNOWN';

            mockSupabase.rpc.mockResolvedValue({ data: null, error });

            await expect(creditsService.consumeArticleCredit(mockSupabase, payload))
                .rejects.toMatchObject({ message: 'فشل في خصم الرصيد', statusCode: 500 });
        });

        it('should throw AppError if RPC succeeds but returns success: false', async () => {
            mockSupabase.rpc.mockResolvedValue({
                data: { success: false, message: 'Not enough credits' },
                error: null
            });

            await expect(creditsService.consumeArticleCredit(mockSupabase, payload))
                .rejects.toMatchObject({ message: 'Not enough credits', statusCode: 400 });
        });
    });

    describe('checkArticleAccess', () => {
        const payload = { articleId: 'a1', userId: 'u1' };

        it('should handle missing article (PGRST116)', async () => {
            const error = new Error('Not found');
            error.code = 'PGRST116';
            mockSupabase.single.mockResolvedValue({ data: null, error });

            await expect(creditsService.checkArticleAccess(mockSupabase, payload))
                .rejects.toMatchObject({ statusCode: 404 });
        });
    });

    describe('redeemLicenseCode', () => {
        const payload = { code: ' ABC ', userId: 'u1', metadata: {} };

        it('should trim and uppercase the code', async () => {
            mockSupabase.rpc.mockResolvedValueOnce({
                data: { success: true, message: 'OK', new_balance: 10 },
                error: null
            });

            await creditsService.redeemLicenseCode(mockSupabase, payload);

            expect(mockSupabase.rpc).toHaveBeenCalledWith('redeem_license_code_v3', expect.objectContaining({
                p_code: 'ABC'
            }));
        });
    });

    describe('checkResearchAccess', () => {
        const payload = { researchId: 'r1', userId: 'u1' };

        it('should throw AppError if checking research access yields error', async () => {
            mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'UNKNOWN' } });

            await expect(creditsService.checkResearchAccess(mockSupabase, payload))
                .rejects.toThrow(AppError);
        });

        it('should return has_access: false when user has no access record', async () => {
        // First .single() call fetches the research item: credits_required must be > 0
        // to avoid the free-content short-circuit. The second .single() call fetches
        // the research_access row (not found => has_access: false).
        mockSupabase.single
            .mockResolvedValueOnce({ data: { credits_required: 5 }, error: null })  // research row
            .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });    // no access row

        const result = await creditsService.checkResearchAccess(mockSupabase, payload);
        expect(result.has_access).toBe(false);
        expect(result.credits_required).toBe(5);
    });

    it('should return has_access: true when user has an access record', async () => {
        mockSupabase.single
            .mockResolvedValueOnce({ data: { credits_required: 5 }, error: null })  // research row
            .mockResolvedValueOnce({ data: { id: 'access-1' }, error: null });       // access row found

        const result = await creditsService.checkResearchAccess(mockSupabase, payload);
        expect(result.has_access).toBe(true);
        expect(result.credits_required).toBe(5);
    });
    });

    describe('getCreditBalance', () => {
        it('should return default structured balance if user not found (PGRST116)', async () => {
            const error = new Error();
            error.code = 'PGRST116';
            mockSupabase.single.mockResolvedValueOnce({ data: null, error });

            const result = await creditsService.getCreditBalance(mockSupabase, 'u1');
            expect(result.balance).toBe(0);
            expect(result.video_watch_minutes).toBe(0);
        });

        it('should throw AppError on general database failure when getting balance', async () => {
            mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'UNKNOWN' } });
            await expect(creditsService.getCreditBalance(mockSupabase, 'u1')).rejects.toThrow(AppError);
            await expect(creditsService.getCreditBalance(mockSupabase, 'u1')).rejects.toMatchObject({ statusCode: 500 });
        });
    });

    describe('getTransactions', () => {
        it('should throw AppError on general database failure when extracting transactions', async () => {
            // getTransactions chain: from('credit_transactions').select().eq().order().range()
            const mockRange = jest.fn().mockResolvedValue({ data: null, error: { code: 'UNKNOWN' } });
            const mockOrder = jest.fn().mockReturnValue({ range: mockRange });
            mockSupabase.eq.mockReturnValue({ order: mockOrder });

            await expect(creditsService.getTransactions(mockSupabase, 'u1')).rejects.toThrow(AppError);
        });
    });
});
