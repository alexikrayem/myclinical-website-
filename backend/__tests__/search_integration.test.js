import { jest } from '@jest/globals';
import request from 'supertest';

// Mocks for limits
jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    searchLimiter: (req, res, next) => next()
}));

// Mock Meilisearch Wrapper
const mockMultiSearch = jest.fn();
jest.unstable_mockModule('../services/search/meiliClient.js', () => ({
    isMeiliEnabled: () => true,
    ensureMeiliIndexes: jest.fn(),
    searchIndex: jest.fn(),
    deleteIndex: jest.fn(),
    getMeiliClient: () => ({
        multiSearch: mockMultiSearch,
        isHealthy: jest.fn(() => Promise.resolve(true))
    })
}));

// Mock Supabase
const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
};

jest.unstable_mockModule('../config/supabase.js', () => ({
    supabasePublic: mockSupabaseClient
}));

// Setup app
const { default: express } = await import('express');
const { default: searchRouter } = await import('../routes/search.js');
const { default: errorHandler } = await import('../middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/search', searchRouter);
if (errorHandler) app.use(errorHandler);

describe('Search Integration API Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabaseClient.from.mockReturnThis();
        mockSupabaseClient.select.mockReturnThis();
        mockSupabaseClient.in.mockReturnThis();
        mockSupabaseClient.or.mockReturnThis();
        mockSupabaseClient.order.mockReturnThis();
        mockSupabaseClient.range.mockReturnThis();
        mockMultiSearch.mockReset();
    });

    test('GET /api/search - Missing query returns 400', async () => {
        const res = await request(app).get('/api/search');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Search query is required');
    });

    test('GET /api/search - Success through Meilisearch', async () => {
        // Meilisearch hits
        mockMultiSearch.mockResolvedValueOnce({
            results: [
                { hits: [{ id: 'article-1', _rankingScore: 0.9 }], estimatedTotalHits: 1 }, // articles
                { hits: [], estimatedTotalHits: 0 }, // researches
                { hits: [], estimatedTotalHits: 0 }  // courses
            ]
        });

        // Supabase fetch for hydrated items
        mockSupabaseClient.in.mockResolvedValueOnce({
            data: [{ id: 'article-1', title: 'Top Dentistry' }],
            error: null
        }).mockResolvedValueOnce({
            data: [], error: null
        }).mockResolvedValueOnce({
            data: [], error: null
        });

        const res = await request(app).get('/api/search?q=dentistry');

        expect(res.status).toBe(200);
        expect(res.body.byType.articles.data[0].id).toBe('article-1');
        expect(res.body.pagination.total).toBe(1);
        expect(mockMultiSearch).toHaveBeenCalled();
    });

    test('GET /api/search - Falls back to Supabase if Meilisearch fails', async () => {
        // Meilisearch throws error
        mockMultiSearch.mockRejectedValueOnce(new Error('Meili is down'));

        // Supabase fallback tasks
        mockSupabaseClient.range.mockResolvedValueOnce({
            data: [{ id: 'article-2', title: 'Backup' }],
            count: 1
        }).mockResolvedValueOnce({
            data: [], count: 0
        }).mockResolvedValueOnce({
            data: [], count: 0
        });

        const res = await request(app).get('/api/search?q=fallback');

        expect(res.status).toBe(200);
        expect(res.body.fallback).toBe(true);
        expect(res.body.byType.articles.data[0].id).toBe('article-2');
        expect(res.body.pagination.total).toBe(1);
    });

});
