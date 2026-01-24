import { jest } from '@jest/globals';
import request from 'supertest';
// Note: We mock BEFORE importing the app/routes
// import { v4 as uuidv4 } from 'uuid'; 

const validUuid = '123e4567-e89b-12d3-a456-426614174000';

// --- ESM Mocking ---
jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabaseClient)
}));

jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
    aiLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    uploadLimiter: (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/fileValidation.js', () => ({
    validateUploadedFile: () => (req, res, next) => next()
}));

// Mock google-generative-ai to avoid instantiation errors
jest.unstable_mockModule('@google/generative-ai', () => ({
    GoogleGenerativeAI: class {
        getGenerativeModel() { return {}; }
    }
}));

// Mock pdf-parse to avoid file read errors if not already fixed
jest.unstable_mockModule('pdf-parse', () => ({
    default: jest.fn()
}));

// Define Mock Client *after* mockModule but before import
const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    auth: {
        getUser: jest.fn()
    }
};

// Import Express and Router AFTER mocks
// We need to valid dynamic import to ensure mocks apply
const { default: express } = await import('express');
const { default: articlesRouter } = await import('../routes/articles.js');

const app = express();
app.use(express.json());
app.use('/api/articles', articlesRouter);

// --- Tests ---
describe('GET /api/articles/:id Access Control', () => {

    const articleId = validUuid;
    const fullContent = 'This is a very long article content that should be truncated for unauthorized users. ' + 'a'.repeat(800);

    beforeEach(() => {
        jest.clearAllMocks();
        // Default mocks
        mockSupabaseClient.from.mockReturnThis();
        mockSupabaseClient.select.mockReturnThis();
        mockSupabaseClient.eq.mockReturnThis();
    });

    test('Guest should receive truncated content (is_preview: true)', async () => {
        mockSupabaseClient.single.mockResolvedValueOnce({
            data: {
                id: articleId,
                content: fullContent,
                credits_required: 1,
                is_featured: true
            },
            error: null
        });

        const res = await request(app).get(`/api/articles/${articleId}`);

        expect(res.status).toBe(200);
        expect(res.body.is_preview).toBe(true);
        expect(res.body.has_access).toBe(false);
        expect(res.body.content.length).toBeLessThan(fullContent.length);
        expect(res.body.content).toContain('...');
    });

    test('Free article should return full content for Guest', async () => {
        mockSupabaseClient.single.mockResolvedValueOnce({
            data: {
                id: articleId,
                content: fullContent,
                credits_required: 0 // Free
            },
            error: null
        });

        const res = await request(app).get(`/api/articles/${articleId}`);

        expect(res.status).toBe(200);
        expect(res.body.is_preview).toBe(false);
        expect(res.body.has_access).toBe(true);
        expect(res.body.content).toBe(fullContent);
    });

    test('Authorized User (Purchased) should receive full content', async () => {
        const token = 'valid-token';
        const userId = validUuid;

        // Mock Auth
        mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: userId } },
            error: null
        });

        // Mock Article Fetch
        mockSupabaseClient.single.mockResolvedValueOnce({
            data: { id: articleId, content: fullContent, credits_required: 1 },
            error: null
        });

        // Mock Admin Check (Not admin)
        mockSupabaseClient.single.mockResolvedValueOnce({ data: null });

        // Mock Access Check (Has Access)
        mockSupabaseClient.single.mockResolvedValueOnce({ data: { id: 'access-1' } });

        const res = await request(app)
            .get(`/api/articles/${articleId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.is_preview).toBe(false);
        expect(res.body.has_access).toBe(true);
        expect(res.body.content).toBe(fullContent);
    });

    test('Authenticated User (No Purchase) should receive truncated content', async () => {
        const token = 'valid-token';
        const userId = validUuid;

        // Mock Auth
        mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: userId } },
            error: null
        });

        // Mock Article Fetch
        mockSupabaseClient.single.mockResolvedValueOnce({
            data: { id: articleId, content: fullContent, credits_required: 1 },
            error: null
        });

        // Mock Admin Check (Not admin)
        mockSupabaseClient.single.mockResolvedValueOnce({ data: null });

        // Mock Access Check (No Access)
        mockSupabaseClient.single.mockResolvedValueOnce({ data: null });

        const res = await request(app)
            .get(`/api/articles/${articleId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.is_preview).toBe(true);
        expect(res.body.has_access).toBe(false);
    });

});
