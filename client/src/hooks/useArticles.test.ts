import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import {
  useArticles,
  useFeaturedArticles,
  useTags,
  useArticle,
  useRelatedArticles
} from './useArticles';
import { articlesApi } from '../lib/api';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

describe('article hooks', () => {
  beforeEach(() => {
    (useQuery as ReturnType<typeof vi.fn>).mockClear();
  });

  it('useArticles configures query with params', async () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue('result');
    const params = { tag: 'news' };
    const result = useArticles(params);

    expect(result).toBe('result');
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.queryKey).toEqual(['articles', params]);

    const getAllSpy = vi.spyOn(articlesApi, 'getAll').mockResolvedValue({ data: [] });
    await config.queryFn();
    expect(getAllSpy).toHaveBeenCalledWith(params);
  });

  it('useFeaturedArticles uses featured query key', () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue('featured');
    useFeaturedArticles();
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.queryKey).toEqual(['featured-articles']);
  });

  it('useTags uses tags query key', () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue('tags');
    useTags();
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.queryKey).toEqual(['tags']);
  });

  it('useArticle disables query when id is empty', () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue('article');
    useArticle('');
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.enabled).toBe(false);
  });

  it('useRelatedArticles includes id and limit in key', () => {
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue('related');
    useRelatedArticles('a1', 4);
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.queryKey).toEqual(['related-articles', 'a1', 4]);
  });
});
