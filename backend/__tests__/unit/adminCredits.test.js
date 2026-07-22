import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mockSupabase, resetSupabaseMock } from '../mocks/supabaseMock.js';

jest.unstable_mockModule('../../config/supabase.js', () => ({ supabaseAdmin: mockSupabase }));
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { id: 'admin-1' };
    next();
  }
}));

const { default: creditsRouter } = await import('../../routes/admin/credits.js');
const app = express();
app.use(express.json());
app.use('/credits', creditsRouter);
app.use((error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
});

describe('admin credit routes', () => {
  beforeEach(() => { resetSupabaseMock(); jest.clearAllMocks(); });

  describe('POST /credits/generate', () => {
    it('coerces numeric strings and supplies defaults', async () => {
      mockSupabase.rpc.mockResolvedValue([{ code: 'GIFT-1111-2222-3333' }]);
      const res = await request(app).post('/credits/generate').send({ amount: '2', prefix: 'gift' });
      expect(res.status).toBe(200);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_license_codes_v4', expect.objectContaining({
        p_amount: 2, p_prefix: 'GIFT', p_credit_value: 0, p_expires_in_days: 365
      }));
    });

    it.each([
      [{ amount: 0 }, 'zero amount'],
      [{ amount: 101 }, 'large amount'],
      [{ amount: 1, prefix: 'bad-prefix!' }, 'invalid prefix'],
      [{ amount: 1, credit_type: 'typed' }, 'typed credits without a type id'],
    ])('rejects %s (%s)', async (body) => {
      const res = await request(app).post('/credits/generate').send(body);
      expect(res.status).toBe(400);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('does not turn absent optional numeric fields into NaN', async () => {
      mockSupabase.rpc.mockResolvedValue([]);
      await request(app).post('/credits/generate').send({ amount: 1 });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_license_codes_v4', expect.objectContaining({
        p_credit_value: 0, p_video_minutes: 0, p_article_count: 0, p_research_count: 0
      }));
    });
  });

  describe('GET /credits/reports and /history', () => {
    it('escapes LIKE wildcards in report searches and applies pagination', async () => {
      mockSupabase._results = { data: [], error: null, count: 1 };
      const res = await request(app).get('/credits/reports?search=%25_%5C&page=2&limit=10');
      expect(res.status).toBe(200);
      expect(mockSupabase.or).toHaveBeenCalledWith(expect.stringContaining('\\\\'));
      expect(mockSupabase.range).toHaveBeenCalledWith(10, 19);
      expect(res.body.pagination).toMatchObject({ page: 2, limit: 10, total: 1 });
    });

    it.each(['/credits/reports?page=0', '/credits/history?limit=101'])('rejects invalid pagination: %s', async (path) => {
      await expect(request(app).get(path)).resolves.toMatchObject({ status: 400 });
    });

    it('paginates history deterministically', async () => {
      mockSupabase._results = { data: [], error: null, count: 21 };
      const res = await request(app).get('/credits/history?page=2&limit=20');
      expect(res.body.pagination).toMatchObject({ page: 2, limit: 20, pages: 2 });
      expect(mockSupabase.range).toHaveBeenCalledWith(20, 39);
    });
  });

  describe('GET /credits/types', () => {
    it('flattens linked course ids', async () => {
      mockSupabase._results = { data: [{ id: 'type-1', credit_type_courses: [{ course_id: 'course-1' }] }], error: null };
      const res = await request(app).get('/credits/types');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'type-1', course_ids: ['course-1'] }]);
    });

    it('maps database failures to an application error', async () => {
      mockSupabase._results = { data: null, error: { code: 'XX000' } };
      await expect(request(app).get('/credits/types')).resolves.toMatchObject({ status: 500, body: { code: 'ADMIN_CREDIT_TYPES_FETCH_FAILED' } });
    });
  });
});
