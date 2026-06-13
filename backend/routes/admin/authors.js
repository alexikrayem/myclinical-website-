import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { validateUploadedFile } from '../../middleware/fileValidation.js';
import { uploadToSupabase } from './utils.js';
import logger from '../../config/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create author
router.post('/', authenticateToken, uploadLimiter, upload.single('image'), validateUploadedFile(['jpg', 'jpeg', 'png']), asyncHandler(async (req, res) => {
    const { name, bio, specialization, experience_years, education, location, email, website, is_active } = req.body;

    let image = '';
    if (req.file) {
        image = await uploadToSupabase(req.file, 'images');
    } else if (req.body.image_url) {
        image = req.body.image_url;
    } else {
        return res.status(400).json({ error: 'Author image is required' });
    }

    const { data, error } = await supabase
        .from('authors')
        .insert([{
            name, bio, image, specialization,
            experience_years: parseInt(experience_years) || 1,
            education, location,
            email: email || null,
            website: website || null,
            is_active: is_active === 'true',
        }])
        .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.status(201).json(data[0]);
}));

// Update author
router.put('/:id', authenticateToken, uploadLimiter, upload.single('image'), validateUploadedFile(['jpg', 'jpeg', 'png']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, bio, specialization, experience_years, education, location, email, website, is_active } = req.body;

    const { data: existing, error: fetchErr } = await supabase
        .from('authors')
        .select('image')
        .eq('id', id)
        .single();

    if (fetchErr) throw fetchErr;

    let image = existing.image;
    if (req.file) {
        image = await uploadToSupabase(req.file, 'images');
    } else if (req.body.image_url) {
        image = req.body.image_url;
    }

    const { data, error } = await supabase
        .from('authors')
        .update({
            name, bio, image, specialization,
            experience_years: parseInt(experience_years) || 1,
            education, location,
            email: email || null,
            website: website || null,
            is_active: is_active === 'true',
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json(data[0]);
}));

// Delete author
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('authors')
        .delete()
        .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json({ message: 'Author deleted successfully' });
}));

export default router;
