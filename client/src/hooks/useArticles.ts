import { useQuery } from '@tanstack/react-query';
import { articlesApi, researchApi, coursesApi } from '../lib/api';

import { Article, Course, Research, FeaturedContent } from '../types';

export const useArticles = (params?: { tag?: string; search?: string; limit?: number; page?: number }) => {
    return useQuery({
        queryKey: ['articles', params],
        queryFn: () => articlesApi.getAll(params),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useFeaturedArticles = () => {
    return useQuery({
        queryKey: ['featured-articles'],
        queryFn: () => articlesApi.getFeatured(),
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
};

export const useAllFeaturedContent = () => {
    return useQuery({
        queryKey: ['all-featured-content'],
        queryFn: async () => {
            const ENABLE_COURSES = import.meta.env.VITE_ENABLE_COURSES !== 'false';

            // Fetch all three sources concurrently, with catch handlers to prevent one failure from dropping all
            const [featuredArticles, featuredCourses, latestResearches] = await Promise.all([
                articlesApi.getFeatured().catch(() => []),
                ENABLE_COURSES ? coursesApi.getFeatured().catch(() => []) : Promise.resolve([]),
                researchApi.getFeatured().catch(() => [])
            ]);

            // Combine and map articles & clinical cases
            const mappedArticles: FeaturedContent[] = (featuredArticles || []).map((a: Article) => ({
                id: a.id,
                title: a.title,
                excerpt: a.excerpt,
                cover_image: a.cover_image,
                author: a.author,
                author_image: a.author_image,
                type: a.article_type || 'article', // 'article' or 'clinical_case'
                path: `/articles/${a.id}`, // using same route engine for both
                publication_date: a.publication_date || new Date().toISOString(),
                date: new Date(a.publication_date || Date.now()).getTime(),
            }));

            // Combine and map courses
            const mappedCourses: FeaturedContent[] = (featuredCourses || []).map((c: Course) => ({
                id: c.id,
                title: c.title,
                excerpt: c.description || c.excerpt || '',
                cover_image: c.thumbnail_url || c.cover_image || '',
                author: c.instructor?.name || c.author || 'خبراء المنصة',
                author_image: c.instructor?.avatar_url || null,
                type: 'course',
                path: `/courses/${c.id}`,
                publication_date: c.created_at || c.published_at || new Date().toISOString(),
                date: new Date(c.created_at || c.published_at || Date.now()).getTime(),
            }));

            // Combine and map researches (using latest as proxy for featured since researches table lacks is_featured)
            const mappedResearch: FeaturedContent[] = (latestResearches || []).map((r: Research) => ({
                id: r.id,
                title: r.title,
                excerpt: r.abstract || r.excerpt || '',
                cover_image: null,
                author: (r.authors && r.authors.length > 0) ? r.authors[0] : 'باحث',
                author_image: null,
                type: 'research',
                path: `/research-topics?id=${r.id}`,
                publication_date: r.publication_date || new Date().toISOString(),
                date: new Date(r.publication_date || Date.now()).getTime(),
            }));

            const combined = [...mappedArticles, ...mappedCourses, ...mappedResearch];
            // Sort combined effectively by date desc
            return combined.sort((a, b) => b.date - a.date);
        },
        staleTime: 1000 * 60 * 10,
    });
};

export const useTags = () => {
    return useQuery({
        queryKey: ['tags'],
        queryFn: () => articlesApi.getTags(),
        staleTime: 1000 * 60 * 60, // 1 hour (tags don't change often)
    });
};

export const useArticle = (id: string) => {
    return useQuery({
        queryKey: ['article', id],
        queryFn: () => articlesApi.getById(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useRelatedArticles = (id: string, limit = 3) => {
    return useQuery({
        queryKey: ['related-articles', id, limit],
        queryFn: () => articlesApi.getRelated(id, limit),
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useArticlesByTags = (tags?: string[], limit = 5) => {
    return useQuery({
        queryKey: ['articles-by-tags', tags, limit],
        queryFn: () => articlesApi.getByTags(tags, limit),
        staleTime: 1000 * 60 * 5,
    });
};

export const useLatestResearch = (limit = 4) => {
    return useQuery({
        queryKey: ['latest-research', limit],
        queryFn: () => researchApi.getAll({ limit }),
        staleTime: 1000 * 60 * 5,
    });
};
