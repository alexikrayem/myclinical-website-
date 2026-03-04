import { describe, it, expect, vi } from 'vitest';
import { codeService } from './codeService';
import { api } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('codeService', () => {
  it('posts payload to generate codes', async () => {
    const apiPost = api.post as ReturnType<typeof vi.fn>;
    apiPost.mockResolvedValue({ data: { codes: [], count: 0 } });

    const result = await codeService.generate(2, 5, 'DX', 'article', 10, 3);

    expect(apiPost).toHaveBeenCalledWith('/admin/codes/generate', {
      amount: 2,
      credit_value: 5,
      prefix: 'DX',
      credit_type: 'article',
      video_minutes: 10,
      article_count: 3,
    });
    expect(result).toEqual({ codes: [], count: 0 });
  });

  it('fetches history with paging params', async () => {
    const apiGet = api.get as ReturnType<typeof vi.fn>;
    apiGet.mockResolvedValue({ data: { data: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } } });

    const result = await codeService.getHistory(2, 15);

    expect(apiGet).toHaveBeenCalledWith('/admin/codes/history', { params: { page: 2, limit: 15 } });
    expect(result).toEqual({ data: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } });
  });
});
