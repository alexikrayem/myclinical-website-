import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { validateUploadedFile } from '../../middleware/fileValidation.js';
import { validateResearch } from '../../middleware/validation.js';
import { sanitizeContent } from '../../middleware/inputSanitizer.js';
import { indexResearch, removeResearch } from '../../services/search/indexer.js';
import { uploadToSupabase } from './utils.js';
import logger from '../../config/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create research
router.post('/', authenticateToken, uploadLimiter, upload.single('research_file'), validateUploadedFile(['pdf', 'doc', 'docx']), validateResearch, asyncHandler(async (req, res) => {
    const { title, authors, journal, publication_date } = req.body;
    const abstract = sanitizeContent(req.body.abstract);

    if (!req.file) {
        return res.status(400).json({ error: 'Research file is required' });
    }

    const file_url = await uploadToSupabase(req.file, 'research-pdfs');

    const { data, error } = await supabase
        .from('researches')
        .insert([{
            title,
            abstract,
            authors: authors ? JSON.parse(authors) : [],
            journal,
            file_url,
            publication_date,
        }])
        .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
        await indexResearch(data[0]);
    } catch (err) {
        logger.error('Search index error (research create):', err);
    }

    res.status(201).json(data[0]);
}));

// Update research
router.put('/:id', authenticateToken, uploadLimiter, upload.single('research_file'), validateUploadedFile(['pdf', 'doc', 'docx']), validateResearch, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, authors, journal, publication_date } = req.body;
    const abstract = sanitizeContent(req.body.abstract);

    const { data: existing, error: fetchErr } = await supabase
        .from('researches')
        .select('file_url')
        .eq('id', id)
        .single();

    if (fetchErr) throw fetchErr;

    let file_url = existing.file_url;
    if (req.file) {
        file_url = await uploadToSupabase(req.file, 'research-pdfs');
    }

    const { data, error } = await supabase
        .from('researches')
        .update({
            title,
            abstract,
            authors: authors ? JSON.parse(authors) : [],
            journal,
            file_url,
            publication_date,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
        await indexResearch(data[0]);
    } catch (err) {
        logger.error('Search index error (research update):', err);
    }

    res.json(data[0]);
}));

// Delete research
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('researches')
        .delete()
        .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
        await removeResearch(id);
    } catch (err) {
        logger.error('Search index error (research delete):', err);
    }

    res.json({ message: 'Research deleted successfully' });
}));

export default router;
