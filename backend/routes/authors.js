import express from 'express';
import { supabasePublic as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

// Get author by name
router.get('/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;

  const { data, error } = await supabase
    .from('authors')
    .select('*')
    .eq('name', decodeURIComponent(name))
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('Failed to fetch author', 500, 'AUTHOR_FETCH_FAILED');
  }

  // If author not found, return default author info
  if (!data) {
    return res.json({
      name: decodeURIComponent(name),
      bio: 'طبيب أسنان متخصص ومؤلف في مجال طب الأسنان',
      image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2',
      specialization: 'طب الأسنان العام',
      experience_years: 5,
      education: 'بكالوريوس طب وجراحة الأسنان',
      location: 'المملكة العربية السعودية'
    });
  }

  res.json(data);
}));

// Get all authors
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('authors')
    .select('*')
    .order('name');

  if (error) {
    throw new AppError('Failed to fetch authors', 500, 'AUTHORS_FETCH_FAILED');
  }

  res.json(data || []);
}));

export default router;
