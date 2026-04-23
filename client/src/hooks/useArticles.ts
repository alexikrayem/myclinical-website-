import { useQuery } from '@tanstack/react-query';
import { articlesApi, researchApi } from '../lib/api';

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
