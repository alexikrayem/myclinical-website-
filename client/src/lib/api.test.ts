import { describe, it, expect, vi, afterEach } from 'vitest';
import api, { searchApi } from './api';

describe('searchApi.searchAll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the unified search endpoint and maps results correctly', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'Article One', slug: 'article-one', type: 'articles' },
          { id: 'r-1', title: 'Research One', type: 'researches' },
          { id: 2, title: 'Course One', type: 'courses' },
          { id: 10, title: 'Unknown', type: 'unknown_type' }
        ]
      }
    });

    const results = await searchApi.searchAll('dent', 5);

    expect(api.get).toHaveBeenCalledWith('/search', { params: { q: 'dent', limit: 5 } });
    expect(results).toEqual([
      { id: '1', title: 'Article One', slug: 'article-one', type: 'article' },
      { id: 'r-1', title: 'Research One', type: 'research' },
      { id: '2', title: 'Course One', type: 'course' },
      { id: '10', title: 'Unknown', type: 'unknown_type' }
    ]);
  });

  it('returns empty array on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(api, 'get').mockRejectedValue(new Error('boom'));

    const results = await searchApi.searchAll('dent', 2);

    expect(results).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith('Error in global search:', expect.any(Error));
  });
});
