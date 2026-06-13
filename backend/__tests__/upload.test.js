import { jest } from '@jest/globals';
import request from 'supertest';
import path from 'path';

// Mock Auth Middleware
jest.unstable_mockModule('../middleware/auth.js', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-admin-id', role: 'admin' };
        next();
    }
}));

// Mock Supabase
const mockSupabaseClient = {
    storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        getPublicUrl: jest.fn()
    }
};

jest.unstable_mockModule('../config/supabase.js', () => ({
    supabaseAdmin: mockSupabaseClient
}));

// Import App
const { default: express } = await import('express');
const { default: uploadRouter } = await import('../routes/upload.js');
const { default: errorHandler } = await import('../middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRouter);
if (errorHandler) {
    app.use(errorHandler);
}

describe('Upload API Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabaseClient.storage.from.mockReturnThis();
    });

    test('POST /api/upload - Should upload a valid image and return URL', async () => {
        mockSupabaseClient.storage.upload.mockResolvedValueOnce({
            data: { path: 'test-path.webp' },
            error: null
        });

        mockSupabaseClient.storage.getPublicUrl.mockReturnValueOnce({
            data: { publicUrl: 'https://mock.supabase.co/storage/v1/object/public/images/test-path.webp' }
        });

        const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);

        const res = await request(app)
            .post('/api/upload')
            .attach('image', imageBuffer, 'test.jpg');


        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.url).toContain('mock.supabase.co');
        expect(res.body.filename).toContain('editor-');
        expect(mockSupabaseClient.storage.upload).toHaveBeenCalled();
    });

    test('POST /api/upload - Should reject non-image files', async () => {
        const textBuffer = Buffer.from('hello world');

        // Note: Multer catches this before route logic executes
        const res = await request(app)
            .post('/api/upload')
            .attach('image', textBuffer, 'test.txt');

        // Express default error handler might catch multer errors and return 500, or AppError 500
        // Because we test fileFilter... Wait, Multer throws an Error which gets caught by Express.
        expect(res.status).toBe(500);
    });

    test('POST /api/upload - Should return 400 if no file provided', async () => {
        const res = await request(app).post('/api/upload');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No file uploaded');
    });

    test('POST /api/upload - Should handle Supabase upload errors', async () => {
        mockSupabaseClient.storage.upload.mockResolvedValueOnce({
            data: null,
            error: { message: 'Cloud error' }
        });

        // Valid PNG header (magic number + IHDR chunk start) with enough trailing data
        const imageBuffer = Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]),
            Buffer.alloc(100)
        ]);

        const res = await request(app)
            .post('/api/upload')
            .attach('image', imageBuffer, 'test.png');




        expect(res.status).toBe(500);
        expect(mockSupabaseClient.storage.getPublicUrl).not.toHaveBeenCalled();
    });

});
