import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import {
  useArticles,
  useFeaturedArticles,
  useTags,
  useArticle,
  useRelatedArticles,
  useAllFeaturedContent,
  useArticlesByTags,
  useLatestResearch
} from './useArticles';
import { articlesApi, researchApi, coursesApi } from '../lib/api';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

describe('article hooks', () => {
  beforeEach(() => {
    (useQuery as ReturnType<typeof vi.fn>).mockClear();
    vi.restoreAllMocks();
    vi.stubEnv('VITE_ENABLE_COURSES', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('useArticlesByTags includes tags and limit in key and calls getByTags', async () => {
    useArticlesByTags(['Tag1', 'Tag2'], 10);
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.queryKey).toEqual(['articles-by-tags', ['Tag1', 'Tag2'], 10]);

    const getByTagsSpy = vi.spyOn(articlesApi, 'getByTags').mockResolvedValue([]);
    await config.queryFn();
    expect(getByTagsSpy).toHaveBeenCalledWith(['Tag1', 'Tag2'], 10);
  });

  it('useLatestResearch configures query correctly', async () => {
    useLatestResearch(5);
    const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.queryKey).toEqual(['latest-research', 5]);

    const researchSpy = vi.spyOn(researchApi, 'getAll').mockResolvedValue([]);
    await config.queryFn();
    expect(researchSpy).toHaveBeenCalledWith({ limit: 5 });
  });

  describe('useAllFeaturedContent', () => {
    it('combines and formats featured articles, courses, and research', async () => {
      useAllFeaturedContent();
      const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];

      vi.spyOn(articlesApi, 'getFeatured').mockResolvedValue([{ id: 'a1', title: 'Art 1', publication_date: '2026-05-02T10:00:00Z', article_type: 'article', author: 'A. Author' }]);
      vi.spyOn(coursesApi, 'getFeatured').mockResolvedValue([{ id: 'c1', title: 'Cours 1', created_at: '2026-05-02T11:00:00Z', instructor: { name: 'Inst 1' } }]);
      vi.spyOn(researchApi, 'getFeatured').mockResolvedValue([{ id: 'r1', title: 'Res 1', publication_date: '2026-05-02T09:00:00Z', authors: ['Res Author'] }]);

      const result = await config.queryFn();

      // Expected to be sorted by date desc: Course (11:00) > Article (10:00) > Research (09:00)
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('c1');
      expect(result[0].type).toBe('course');
      expect(result[0].author).toBe('Inst 1');

      expect(result[1].id).toBe('a1');
      expect(result[1].type).toBe('article');
      expect(result[1].author).toBe('A. Author');

      expect(result[2].id).toBe('r1');
      expect(result[2].type).toBe('research');
      expect(result[2].author).toBe('Res Author');
    });

    it('gracefully handles one or more API failures returning partial results', async () => {
      useAllFeaturedContent();
      const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // Research fails, Articles fail, Courses works
      vi.spyOn(articlesApi, 'getFeatured').mockRejectedValue(new Error('Fetch failed'));
      vi.spyOn(coursesApi, 'getFeatured').mockResolvedValue([{ id: 'c1', title: 'Cours 1', created_at: '2026-05-02T11:00:00Z' }]);
      vi.spyOn(researchApi, 'getFeatured').mockRejectedValue(new Error('Fetch failed'));

      const result = await config.queryFn();

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('c1');
    });

    it('returns empty array if all APIs fail', async () => {
      useAllFeaturedContent();
      const config = (useQuery as ReturnType<typeof vi.fn>).mock.calls[0][0];

      vi.spyOn(articlesApi, 'getFeatured').mockRejectedValue(new Error('Fetch failed'));
      vi.spyOn(coursesApi, 'getFeatured').mockRejectedValue(new Error('Fetch failed'));
      vi.spyOn(researchApi, 'getFeatured').mockRejectedValue(new Error('Fetch failed'));

      const result = await config.queryFn();
      expect(result).toEqual([]);
    });
  });
});
