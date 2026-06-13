import { jest } from '@jest/globals';
import request from 'supertest';

// Mock global fetch just in case any internal service hits it
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({}),
        ok: true,
    })
);

// Define Mock Client *before* imports
const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn()
};

// --- ESM Mocking ---
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabaseClient)
}));

// Import Express and Router AFTER mocks
const { default: express } = await import('express');
const { default: authorsRouter } = await import('../routes/authors.js');
const { default: errorHandler } = await import('../middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/authors', authorsRouter);
// attach global error handler to serialize AppError properly during tests
if (errorHandler) {
    app.use(errorHandler);
}

describe('Authors API Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabaseClient.single.mockReset();
        mockSupabaseClient.from.mockReturnThis();
        mockSupabaseClient.select.mockReturnThis();
        mockSupabaseClient.eq.mockReturnThis();
        mockSupabaseClient.order.mockReturnThis();
    });

    test('GET /api/authors/ - Should fetch all authors and return 200', async () => {
        const mockAuthors = [
            { id: '1', name: 'Author A' },
            { id: '2', name: 'Author B' }
        ];

        mockSupabaseClient.order.mockResolvedValueOnce({
            data: mockAuthors,
            error: null
        });

        const res = await request(app).get('/api/authors/');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockAuthors);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('authors');
        expect(mockSupabaseClient.order).toHaveBeenCalledWith('name');
    });

    test('GET /api/authors/ - Should handle database errors', async () => {
        mockSupabaseClient.order.mockResolvedValueOnce({
            data: null,
            error: { message: 'Database error' }
        });

        const res = await request(app).get('/api/authors/');

        expect(res.status).toBe(500);
    });

    test('GET /api/authors/:name - Should return specific author', async () => {
        const mockAuthor = { id: '10', name: 'Author Name', bio: 'Expert' };

        mockSupabaseClient.single.mockResolvedValueOnce({
            data: mockAuthor,
            error: null
        });

        const res = await request(app).get('/api/authors/Author%20Name');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockAuthor);
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('name', 'Author Name');
    });

    test('GET /api/authors/:name - Should return default author payload if not found', async () => {
        // PGRST116 means zero rows returned from supabase single()
        mockSupabaseClient.single.mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116' }
        });

        const res = await request(app).get('/api/authors/Unknown%20Doctor');

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Unknown Doctor');
        expect(res.body.bio).toContain('طبيب أسنان');
        expect(res.body.experience_years).toBe(5);
    });

    test('GET /api/authors/:name - Should handle real database errors when fetching by name', async () => {
        mockSupabaseClient.single.mockResolvedValueOnce({
            data: null,
            error: { code: 'UNKNOWN_ERROR', message: 'Something crashed' }
        });

        const res = await request(app).get('/api/authors/ErrorDoctor');

        expect(res.status).toBe(500);
    });

});
