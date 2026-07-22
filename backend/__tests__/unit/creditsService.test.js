import { jest } from '@jest/globals';
import * as creditsService from '../../services/credits/creditsService.js';

const ARTICLE_ID = '11111111-1111-4111-8111-111111111111';
const RESEARCH_ID = '22222222-2222-4222-8222-222222222222';

function createSupabaseMock() {
  const client = {
    from: jest.fn(), select: jest.fn(), eq: jest.fn(), gt: jest.fn(), limit: jest.fn(),
    order: jest.fn(), range: jest.fn(), single: jest.fn(), rpc: jest.fn()
  };
  for (const method of ['from', 'select', 'eq', 'gt', 'order']) client[method].mockReturnValue(client);
  client.limit.mockResolvedValue({ data: [], error: null });
  return client;
}

describe('creditsService', () => {
  let supabase;

  beforeEach(() => { supabase = createSupabaseMock(); });

  describe('RPC result hardening', () => {
    const cases = [
      ['redeemLicenseCode', { code: 'GIFT-1111-2222-3333', userId: 'u1', metadata: {} }],
      ['consumeVideoMinutes', { userId: 'u1', minutes: 1, courseId: 'course-1' }],
      ['consumeArticleCredit', { userId: 'u1', articleId: ARTICLE_ID }],
      ['consumeResearchCredit', { userId: 'u1', researchId: RESEARCH_ID }],
    ];

    it.each(cases)('%s rejects an empty successful RPC response', async (method, payload) => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });
      await expect(creditsService[method](supabase, payload))
        .rejects.toMatchObject({ statusCode: 500, code: 'CREDITS_UNEXPECTED_NULL' });
    });
  });

  describe('redeemLicenseCode', () => {
    const payload = { code: ' gift-1111-2222-3333 ', userId: 'u1', metadata: {} };

    it('normalizes the code before calling the RPC', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: true, message: 'OK', new_balance: 10 }, error: null });
      await creditsService.redeemLicenseCode(supabase, payload);
      expect(supabase.rpc).toHaveBeenCalledWith('redeem_license_code_v3', expect.objectContaining({ p_code: 'GIFT-1111-2222-3333' }));
    });

    it('maps RPC errors to a server error', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
      await expect(creditsService.redeemLicenseCode(supabase, payload)).rejects.toMatchObject({ code: 'CREDITS_REDEEM_FAILED' });
    });

    it('surfaces an RPC rejection message', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: false, message: 'Invalid code' }, error: null });
      await expect(creditsService.redeemLicenseCode(supabase, payload)).rejects.toMatchObject({ statusCode: 400, message: 'Invalid code' });
    });
  });

  describe('consumeVideoMinutes', () => {
    it.each([0, -1, Number.NaN, Infinity])('rejects invalid minute values (%p) before the RPC', async (minutes) => {
      await expect(creditsService.consumeVideoMinutes(supabase, { userId: 'u1', minutes, courseId: 'course-1' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_VIDEO_MINUTES' });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('rounds fractional minutes up and preserves large valid inputs', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: true, remaining_minutes: 7, remaining_balance: 3 }, error: null });
      await creditsService.consumeVideoMinutes(supabase, { userId: 'u1', minutes: 2.1, courseId: 'course-1' });
      expect(supabase.rpc).toHaveBeenLastCalledWith('consume_video_minutes', expect.objectContaining({ p_minutes: 3 }));
      await creditsService.consumeVideoMinutes(supabase, { userId: 'u1', minutes: 100000, courseId: 'course-1' });
      expect(supabase.rpc).toHaveBeenLastCalledWith('consume_video_minutes', expect.objectContaining({ p_minutes: 100000 }));
    });

    it('maps an insufficient-credit response', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: false, message: 'رصيد غير كافي' }, error: null });
      await expect(creditsService.consumeVideoMinutes(supabase, { userId: 'u1', minutes: 1, courseId: 'course-1' }))
        .rejects.toMatchObject({ code: 'CREDITS_INSUFFICIENT' });
    });
  });

  describe('article and research consumption', () => {
    it.each([
      ['consumeArticleCredit', { userId: 'u1', articleId: ARTICLE_ID }],
      ['consumeResearchCredit', { userId: 'u1', researchId: RESEARCH_ID }],
    ])('%s returns an idempotent result for 23505', async (method, payload) => {
      supabase.rpc.mockResolvedValue({ data: null, error: { code: '23505' } });
      await expect(creditsService[method](supabase, payload)).resolves.toMatchObject({ success: true });
    });

    it.each([
      ['consumeArticleCredit', { userId: 'u1', articleId: ARTICLE_ID }],
      ['consumeResearchCredit', { userId: 'u1', researchId: RESEARCH_ID }],
    ])('%s maps non-duplicate RPC errors', async (method, payload) => {
      supabase.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
      await expect(creditsService[method](supabase, payload)).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('content access checks', () => {
    it.each([
      ['checkArticleAccess', { articleId: 'not-a-uuid', userId: 'u1' }],
      ['checkResearchAccess', { researchId: 'not-a-uuid', userId: 'u1' }],
    ])('%s rejects malformed content ids before querying', async (method, payload) => {
      await expect(creditsService[method](supabase, payload)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CONTENT_ID' });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns an authentication requirement for paid anonymous article access', async () => {
      supabase.single.mockResolvedValue({ data: { credits_required: 2 }, error: null });
      await expect(creditsService.checkArticleAccess(supabase, { articleId: ARTICLE_ID, userId: null }))
        .resolves.toEqual({ has_access: false, requires_auth: true, credits_required: 2 });
    });

    it('allows free content and administrator access without an access lookup', async () => {
      supabase.single.mockResolvedValueOnce({ data: { credits_required: 0 }, error: null });
      await expect(creditsService.checkArticleAccess(supabase, { articleId: ARTICLE_ID, userId: 'u1' })).resolves.toMatchObject({ free: true });
      supabase.single.mockResolvedValueOnce({ data: { credits_required: 3 }, error: null });
      await expect(creditsService.checkResearchAccess(supabase, { researchId: RESEARCH_ID, userId: 'u1', isAdmin: true })).resolves.toMatchObject({ is_admin: true });
    });

    it('handles missing content and safely denies when the access query fails', async () => {
      supabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      await expect(creditsService.checkArticleAccess(supabase, { articleId: ARTICLE_ID, userId: 'u1' })).rejects.toMatchObject({ statusCode: 404, code: 'ARTICLE_NOT_FOUND' });
      supabase.single.mockResolvedValueOnce({ data: { credits_required: 3 }, error: null }).mockResolvedValueOnce({ data: null, error: { code: 'XX000' } });
      await expect(creditsService.checkResearchAccess(supabase, { researchId: RESEARCH_ID, userId: 'u1' })).resolves.toMatchObject({ has_access: false });
    });

    it('returns access when a delegated research access row exists', async () => {
      supabase.single.mockResolvedValueOnce({ data: { credits_required: 3 }, error: null }).mockResolvedValueOnce({ data: { id: 'access-1' }, error: null });
      await expect(creditsService.checkResearchAccess(supabase, { researchId: RESEARCH_ID, userId: 'u1' })).resolves.toMatchObject({ has_access: true });
      expect(supabase.from).toHaveBeenNthCalledWith(1, 'researches');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'research_access');
    });
  });

  describe('getCreditBalance', () => {
    it('returns defaults for a missing balance and caps typed-credit rows', async () => {
      supabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      supabase.limit.mockResolvedValue({ data: [], error: null });
      const balance = await creditsService.getCreditBalance(supabase, 'u1');
      expect(balance).toMatchObject({ balance: 0, typed_credits: [] });
      expect(supabase.limit).toHaveBeenCalledWith(50);
    });

    it('reports typed-credit lookup failures without hiding the generic balance', async () => {
      supabase.single.mockResolvedValue({ data: { balance: 9 }, error: null });
      supabase.limit.mockResolvedValue({ data: null, error: { code: 'XX000' } });
      await expect(creditsService.getCreditBalance(supabase, 'u1')).resolves.toMatchObject({ balance: 9, typed_credits: [], typed_credits_error: true });
    });

    it('maps generic balance lookup failures to an application error', async () => {
      supabase.single.mockResolvedValue({ data: null, error: { code: 'XX000' } });
      await expect(creditsService.getCreditBalance(supabase, 'u1'))
        .rejects.toMatchObject({ statusCode: 500, code: 'CREDITS_BALANCE_FAILED' });
    });
  });

  describe('getTransactions', () => {
    it('uses the object argument and normalizes pagination boundaries', async () => {
      supabase.range.mockResolvedValue({ data: [], count: 0, error: null });
      const result = await creditsService.getTransactions(supabase, { userId: 'u1', page: 0, limit: -2, type: 'usage' });
      expect(result.pagination).toEqual({ total: 0, page: 1, limit: 1, pages: 0 });
      expect(supabase.range).toHaveBeenCalledWith(0, 0);
      expect(supabase.eq).toHaveBeenLastCalledWith('transaction_type', 'usage');
    });

    it('caps large limits and maps query errors', async () => {
      supabase.range.mockResolvedValueOnce({ data: [], count: 201, error: null });
      await expect(creditsService.getTransactions(supabase, { userId: 'u1', page: 2, limit: 999 })).resolves.toMatchObject({ pagination: { page: 2, limit: 100, pages: 3 } });
      supabase.range.mockResolvedValueOnce({ data: null, error: { code: 'XX000' } });
      await expect(creditsService.getTransactions(supabase, { userId: 'u1' })).rejects.toMatchObject({ code: 'CREDITS_TRANSACTIONS_FAILED' });
    });
  });
});
