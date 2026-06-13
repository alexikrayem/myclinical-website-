import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import logger from '../../config/logger.js';

const router = express.Router();

// Get all categories
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

    if (error) {
        logger.error('Error fetching categories:', error);
        throw new AppError('Failed to fetch categories', 500, 'ADMIN_CATEGORIES_FETCH_FAILED');
    }
    res.json(data);
}));

// Create category
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    const { name, name_ar, description, color, is_active } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    const { data, error } = await supabase
        .from('categories')
        .insert([{
            name: name.trim(),
            name_ar: name_ar?.trim() || null,
            description: description?.trim() || null,
            color: color || '#3B82F6',
            is_active: is_active !== false
        }])
        .select();

    if (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Category already exists' });
        }
        logger.error('Error creating category:', error);
        throw new AppError('Failed to create category', 500, 'ADMIN_CATEGORY_CREATE_FAILED');
    }

    res.status(201).json(data[0]);
}));

// Update category
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, name_ar, description, color, is_active } = req.body;

    const { data, error } = await supabase
        .from('categories')
        .update({
            name: name?.trim(),
            name_ar: name_ar?.trim() || null,
            description: description?.trim() || null,
            color: color || '#3B82F6',
            is_active: is_active,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

    if (error) {
        logger.error('Error updating category:', error);
        throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    }
    res.json(data[0]);
}));

// Delete category
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) {
        logger.error('Error deleting category:', error);
        throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    }
    res.json({ message: 'Category deleted successfully' });
}));

export default router;
