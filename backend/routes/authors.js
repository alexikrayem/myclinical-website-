import express from 'express';
import { supabasePublic as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { applyPublicArticleFilter } from '../utils/articleVisibility.js';

const router = express.Router();

// Public link-in-bio profile. This route is intentionally before /:name.
router.get('/by-slug/:slug', asyncHandler(async (req, res) => {
  const { data: author, error } = await supabase
    .from('authors')
    .select('id, name, bio, image, avatar_url, headline, specialization, experience_years, education, location, social_links, slug')
    .eq('slug', req.params.slug)
    .eq('is_profile_public', true)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new AppError('Failed to fetch author profile', 500, 'AUTHOR_FETCH_FAILED');
  if (!author) return res.status(404).json({ error: 'Author not found', code: 'AUTHOR_NOT_FOUND' });

  const [articlesResult, coursesResult] = await Promise.all([
    applyPublicArticleFilter(supabase.from('articles')
      .select('id, title, slug, excerpt, cover_image, publication_date, tags, article_type')
      .eq('author_id', author.id))
      .order('publication_date', { ascending: false }),
    supabase.from('courses_public')
      .select('id, title, description, cover_image, publication_date, categories, duration, level')
      .eq('author_id', author.id)
      .order('publication_date', { ascending: false })
  ]);
  if (articlesResult.error || coursesResult.error) throw new AppError('Failed to fetch author content', 500, 'AUTHOR_CONTENT_FETCH_FAILED');
  res.json({ ...author, articles: articlesResult.data || [], courses: coursesResult.data || [] });
}));

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
