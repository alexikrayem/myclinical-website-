import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { validateUploadedFile } from '../../middleware/fileValidation.js';
import { sanitizeContent } from '../../middleware/inputSanitizer.js';
import { invalidateCachePattern } from '../../middleware/cache.js';
import { indexArticle, removeArticle } from '../../services/search/indexer.js';
import { uploadToSupabase } from './utils.js';
import logger from '../../config/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: Generate slug from title
const generateSlug = (title) => {
    let slug = title.toLowerCase()
        .replace(/[^\u0621-\u064Aa-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    return slug || `article-${Date.now()}`;
};

// Create article
router.post('/',
    authenticateToken,
    uploadLimiter,
    upload.single('cover_image'),
    validateUploadedFile(['jpg', 'jpeg', 'png']),
    [
        body('title').trim().isLength({ min: 5, max: 200 }),
        body('excerpt').trim().isLength({ min: 10, max: 500 }),
        body('author').trim()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { title, author, tags, is_featured } = req.body;
        const content = sanitizeContent(req.body.content);
        const excerpt = sanitizeContent(req.body.excerpt);

        let cover_image = '';
        if (req.file) {
            cover_image = await uploadToSupabase(req.file, 'images');
        } else if (req.body.cover_image_url) {
            cover_image = req.body.cover_image_url;
        } else {
            return res.status(400).json({ error: 'Cover image is required' });
        }

        const { data, error } = await supabase
            .from('articles')
            .insert([{
                title,
                excerpt,
                content,
                cover_image,
                author,
                tags: tags ? JSON.parse(tags) : [],
                is_featured: is_featured === 'true',
                credits_required: parseInt(req.body.credits_required) || 0,
                article_type: req.body.article_type || 'article',
                slug: generateSlug(title),
                publication_date: new Date().toISOString(),
            }])
            .select();

        if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

        try {
            await indexArticle(data[0]);
        } catch (err) {
            logger.error('Search index error (article create):', err);
        }

        await invalidateCachePattern('cache:/api/articles*');
        res.status(201).json(data[0]);
    }));

// Update article
router.put('/:id',
    authenticateToken,
    uploadLimiter,
    upload.single('cover_image'),
    validateUploadedFile(['jpg', 'jpeg', 'png']),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { title, author, tags, is_featured } = req.body;
        const content = sanitizeContent(req.body.content);
        const excerpt = sanitizeContent(req.body.excerpt);

        const { data: existing, error: fetchErr } = await supabase
            .from('articles')
            .select('cover_image')
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        let cover_image = existing.cover_image;
        if (req.file) {
            cover_image = await uploadToSupabase(req.file, 'images');
        } else if (req.body.cover_image_url) {
            cover_image = req.body.cover_image_url;
        }

        const { data, error } = await supabase
            .from('articles')
            .update({
                title,
                excerpt,
                content,
                cover_image,
                author,
                tags: tags ? JSON.parse(tags) : [],
                is_featured: is_featured === 'true',
                credits_required: parseInt(req.body.credits_required) || 0,
                article_type: req.body.article_type || 'article',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select();

        if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

        try {
            await indexArticle(data[0]);
        } catch (err) {
            logger.error('Search index error (article update):', err);
        }

        await invalidateCachePattern('cache:/api/articles*');
        res.json(data[0]);
    }));

// Delete article
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
        await removeArticle(id);
    } catch (err) {
        logger.error('Search index error (article delete):', err);
    }

    await invalidateCachePattern('cache:/api/articles*');
    res.json({ message: 'Article deleted successfully' });
}));

export default router;
