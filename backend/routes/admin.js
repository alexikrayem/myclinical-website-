import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { validateArticle, validateResearch } from '../middleware/validation.js';
import { authenticateToken, trackLoginAttempt, checkLoginAllowed } from '../middleware/auth.js';
import { authLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import { validateUploadedFile } from '../middleware/fileValidation.js';
import { sanitizeFileName, sanitizeContent } from '../middleware/inputSanitizer.js';
import { invalidateCachePattern } from '../middleware/cache.js';
import { sanitizeSearchInput } from '../utils/searchUtils.js';
import { ADMIN_SELECT } from '../utils/queryFields.js';
import { body, validationResult, query } from 'express-validator';
import { indexArticle, indexResearch, removeArticle, removeResearch, indexCourse, removeCourse } from '../services/search/indexer.js';
import { supabaseAdmin as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Set up multer storage (Memory Storage for Supabase Upload)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed!'));
    }
  }
});

// Helper function to upload to Supabase
const uploadToSupabase = async (file, bucket = 'images') => {
  try {
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw new Error('Failed to upload file to Supabase');
  }
};

// Admin authentication - FIXED
// Admin authentication with rate limiting and security
router.post('/login',
  authLimiter,
  checkLoginAllowed,
  [
    body('email').isEmail().withMessage('بريد إلكتروني غير صالح').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('كلمة المرور قصيرة جداً')
  ],
  asyncHandler(async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { email, password } = req.body;

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await trackLoginAttempt(email, false);
        return res.status(400).json({
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      }

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Track failed attempt
        const attemptResult = await trackLoginAttempt(email, false);

        if (process.env.NODE_ENV === 'development') {
          console.error('Auth error:', authError.message);
        }

        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          remainingAttempts: attemptResult.remainingAttempts
        });
      }

      if (!authData.user) {
        await trackLoginAttempt(email, false);
        return res.status(401).json({
          error: 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }

      // Check if the user is an admin
      if (process.env.NODE_ENV === 'development') {
        console.log('Checking admin status for User ID:', authData.user.id);
      }

      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select(ADMIN_SELECT)
        .eq('id', authData.user.id)
        .single();

      if (process.env.NODE_ENV === 'development') {
        console.log('Admin Lookup Result:', { adminData, adminError });
      }

      if (adminError || !adminData) {
        await trackLoginAttempt(email, false);

        if (process.env.NODE_ENV === 'development') {
          console.error('Admin check error:', adminError);
        }

        return res.status(403).json({
          error: 'Access denied - insufficient permissions',
          code: 'NOT_ADMIN'
        });
      }

      // Successful login - reset attempts
      // Successful login - reset attempts
      await trackLoginAttempt(email, true);

      // Set secure cookie options
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      };

      // Return success response with session data
      res
        .cookie('session', authData.session.access_token, cookieOptions)
        .json({
          message: 'Login successful',
          user: {
            id: adminData.id,
            email: adminData.email,
            role: adminData.role,
          },
          session: {
            access_token: authData.session.access_token,
            expires_at: authData.session.expires_at,
          },
        });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', error);
      }
      throw new AppError('An error occurred during login', 500, 'INTERNAL_ERROR');
    }
  }));

// Logout endpoint
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Clear session cookie
    res.clearCookie('session');

    res.json({
      message: 'Logout successful',
      code: 'LOGOUT_SUCCESS'
    });
  } catch (error) {
    throw new AppError('An error occurred during logout', 500, 'LOGOUT_ERROR');
  }
}));
// Get admin profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { data: adminData, error } = await supabase
      .from('admins')
      .select('id, email, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) {
      throw new AppError('Failed to fetch admin profile', 500, 'ADMIN_PROFILE_FAILED');
    }

    res.json(adminData);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    throw new AppError('Failed to fetch admin profile', 500, 'ADMIN_PROFILE_FAILED');
  }
}));

// Create new article
router.post('/articles',
  authenticateToken,
  uploadLimiter,
  upload.single('cover_image'),
  validateUploadedFile(['jpg', 'jpeg', 'png']),
  validateArticle,
  [
    body('title').trim().isLength({ min: 5, max: 200 }).escape(),
    body('excerpt').trim().isLength({ min: 10, max: 500 }).escape(),
    // content is HTML, so we might want to sanitize it differently or rely on frontend + basic checks
    body('author').trim().escape()
  ],
  asyncHandler(async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { title, author, tags, is_featured } = req.body;
      const content = sanitizeContent(req.body.content);
      const excerpt = sanitizeContent(req.body.excerpt);

      let cover_image = '';

      // If file was uploaded
      if (req.file) {
        cover_image = await uploadToSupabase(req.file, 'images');
      } else if (req.body.cover_image_url) {
        // If external URL was provided
        cover_image = req.body.cover_image_url;
      } else {
        return res.status(400).json({ error: 'Cover image is required' });
      }

      // Generate slug from title
      const generateSlug = (title) => {
        let slug = title.toLowerCase()
          .replace(/[^\u0621-\u064Aa-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        return slug || `article-${Date.now()}`;
      };

      const { data, error } = await supabase
        .from('articles')
        .insert([
          {
            title,
            excerpt,
            content,
            cover_image,
            author,
            tags: JSON.parse(tags), // Convert JSON string to array
            is_featured: is_featured === 'true',
            credits_required: parseInt(req.body.credits_required) || 0,
            article_type: req.body.article_type || 'article',
            slug: generateSlug(title),
            publication_date: new Date().toISOString(),
          }
        ])
        .select();

      if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

      try {
        await indexArticle(data[0]);
      } catch (indexError) {
        console.error('Search index error (article create):', indexError);
      }

      await invalidateCachePattern('cache:/api/articles*');

      res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error creating article:', error);
      throw new AppError('Failed to create article', 500, 'ADMIN_ARTICLE_CREATE_FAILED');
    }
  }));

// Update article
router.put('/articles/:id', authenticateToken, uploadLimiter, upload.single('cover_image'), validateUploadedFile(['jpg', 'jpeg', 'png']), validateArticle, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, tags, is_featured } = req.body;
    const content = sanitizeContent(req.body.content);
    const excerpt = sanitizeContent(req.body.excerpt);

    // Get the current article to check if cover image exists
    const { data: existingArticle, error: fetchError } = await supabase
      .from('articles')
      .select('cover_image')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    let cover_image = existingArticle.cover_image;

    // Update cover image if a new one was uploaded
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
        tags: JSON.parse(tags), // Convert JSON string to array
        is_featured: is_featured === 'true',
        credits_required: parseInt(req.body.credits_required) || 0,
        article_type: req.body.article_type || 'article', // Add article_type
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
      await indexArticle(data[0]);
    } catch (indexError) {
      console.error('Search index error (article update):', indexError);
    }

    await invalidateCachePattern('cache:/api/articles*');

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating article:', error);
    throw new AppError('Failed to update article', 500, 'ADMIN_ARTICLE_UPDATE_FAILED');
  }
}));

// Delete article
router.delete('/articles/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get the article to check if it has a local image to delete
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('cover_image')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete the article
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
      await removeArticle(id);
    } catch (indexError) {
      console.error('Search index error (article delete):', indexError);
    }

    await invalidateCachePattern('cache:/api/articles*');

    // Note: We are not deleting files from Supabase storage automatically to prevent accidental data loss
    // and because we don't track file references perfectly. 
    // A separate cleanup script would be better for that.

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    throw new AppError('Failed to delete article', 500, 'ADMIN_ARTICLE_DELETE_FAILED');
  }
}));

// Create new course
router.post('/courses',
  authenticateToken,
  uploadLimiter,
  upload.single('cover_image'),
  validateUploadedFile(['jpg', 'jpeg', 'png']),
  [
    body('title').trim().isLength({ min: 3, max: 200 }).escape(),
    body('description').trim().isLength({ min: 10, max: 2000 }).escape(),
    body('author').trim().isLength({ min: 2, max: 200 }).escape()
  ],
  asyncHandler(async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const {
        title,
        author,
        categories,
        is_featured,
        playback_provider,
        playback_source,
        billing_model,
        minute_cost,
        preview_source,
        preview_seconds
      } = req.body;

      const description = sanitizeContent(req.body.description);

      if (!playback_source) {
        return res.status(400).json({ error: 'Playback source is required' });
      }

      let cover_image = '';
      if (req.file) {
        cover_image = await uploadToSupabase(req.file, 'images');
      } else if (req.body.cover_image_url) {
        cover_image = req.body.cover_image_url;
      } else {
        return res.status(400).json({ error: 'Cover image is required' });
      }

      const parsedCategories = categories ? JSON.parse(categories) : [];

      const resolvedBillingModel = billing_model || 'per_minute';
      const parsedMinuteCost = Number.isNaN(parseInt(minute_cost, 10)) ? 1 : parseInt(minute_cost, 10);
      const parsedPreviewSeconds = Number.isNaN(parseInt(preview_seconds, 10)) ? 0 : parseInt(preview_seconds, 10);
      const resolvedMinuteCost = resolvedBillingModel === 'per_minute' ? parsedMinuteCost : 0;

      const { data, error } = await supabase
        .from('video_courses')
        .insert([
          {
            title,
            description,
            cover_image,
            playback_source,
            playback_provider: playback_provider || 'vdocipher',
            billing_model: resolvedBillingModel,
            minute_cost: resolvedMinuteCost,
            preview_source: preview_source || null,
            preview_seconds: parsedPreviewSeconds,
            author,
            categories: parsedCategories,
            credits_required: parseInt(req.body.credits_required) || 0,
            duration: parseInt(req.body.duration) || 0,
            is_featured: is_featured === 'true',
            publication_date: new Date().toISOString(),
          }
        ])
        .select();

      if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

      try {
        await indexCourse(data[0]);
      } catch (indexError) {
        console.error('Search index error (course create):', indexError);
      }

      res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error creating course:', error);
      throw new AppError('Failed to create course', 500, 'ADMIN_COURSE_CREATE_FAILED');
    }
  })
);

// Update course
router.put('/courses/:id',
  authenticateToken,
  uploadLimiter,
  upload.single('cover_image'),
  validateUploadedFile(['jpg', 'jpeg', 'png']),
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        author,
        categories,
        is_featured,
        playback_provider,
        playback_source,
        billing_model,
        minute_cost,
        preview_source,
        preview_seconds
      } = req.body;

      const description = sanitizeContent(req.body.description);

      const { data: existingCourse, error: fetchError } = await supabase
        .from('video_courses')
        .select('cover_image')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      let cover_image = existingCourse.cover_image;
      if (req.file) {
        cover_image = await uploadToSupabase(req.file, 'images');
      } else if (req.body.cover_image_url) {
        cover_image = req.body.cover_image_url;
      }

      const parsedCategories = categories ? JSON.parse(categories) : [];

      const resolvedBillingModel = billing_model || 'per_minute';
      const parsedMinuteCost = Number.isNaN(parseInt(minute_cost, 10)) ? 1 : parseInt(minute_cost, 10);
      const parsedPreviewSeconds = Number.isNaN(parseInt(preview_seconds, 10)) ? 0 : parseInt(preview_seconds, 10);
      const resolvedMinuteCost = resolvedBillingModel === 'per_minute' ? parsedMinuteCost : 0;

      const updatePayload = {
        title,
        description,
        cover_image,
        playback_provider: playback_provider || 'vdocipher',
        billing_model: resolvedBillingModel,
        minute_cost: resolvedMinuteCost,
        preview_source: preview_source || null,
        preview_seconds: parsedPreviewSeconds,
        author,
        categories: parsedCategories,
        credits_required: parseInt(req.body.credits_required) || 0,
        duration: parseInt(req.body.duration) || 0,
        is_featured: is_featured === 'true',
        updated_at: new Date().toISOString(),
      };

      if (playback_source) {
        updatePayload.playback_source = playback_source;
      }

      const { data, error } = await supabase
        .from('video_courses')
        .update(updatePayload)
        .eq('id', id)
        .select();

      if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

      try {
        await indexCourse(data[0]);
      } catch (indexError) {
        console.error('Search index error (course update):', indexError);
      }

      res.json(data[0]);
    } catch (error) {
      console.error('Error updating course:', error);
      throw new AppError('Failed to update course', 500, 'ADMIN_COURSE_UPDATE_FAILED');
    }
  })
);

// Get courses list (admin)
router.get('/courses', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { search, limit = 20, page = 1 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('video_courses')
      .select('id, title, cover_image, author, categories, is_featured, credits_required, billing_model, minute_cost, playback_provider', { count: 'exact' });

    if (search) {
      const sanitizedSearch = sanitizeSearchInput(search);
      if (sanitizedSearch) {
        query = query.or(`title.ilike.%${sanitizedSearch}%,author.ilike.%${sanitizedSearch}%`);
      }
    }

    const { data, error, count } = await query
      .order('publication_date', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.json({
      data,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((count || 0) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    throw new AppError('Failed to fetch courses', 500, 'ADMIN_COURSES_FETCH_FAILED');
  }
}));

// Get course by id (admin)
router.get('/courses/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('video_courses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError('Failed to fetch course', 500, 'ADMIN_COURSE_FETCH_FAILED');
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching course:', error);
    throw new AppError('Failed to fetch course', 500, 'ADMIN_COURSE_FETCH_FAILED');
  }
}));

// Delete course
router.delete('/courses/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('video_courses')
      .delete()
      .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
      await removeCourse(id);
    } catch (indexError) {
      console.error('Search index error (course delete):', indexError);
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    throw new AppError('Failed to delete course', 500, 'ADMIN_COURSE_DELETE_FAILED');
  }
}));

// Create new research
router.post('/research', authenticateToken, uploadLimiter, upload.single('research_file'), validateUploadedFile(['pdf', 'doc', 'docx']), validateResearch, asyncHandler(async (req, res) => {
  try {
    const { title, authors, journal, publication_date } = req.body;
    const abstract = sanitizeContent(req.body.abstract);

    if (!req.file) {
      return res.status(400).json({ error: 'Research file is required' });
    }

    // Use a different bucket for research papers if needed, or same 'images' bucket? 
    // Usually research papers are documents. Let's assume 'documents' bucket or just put in 'images' for now if that's the only one.
    // The user said "use supabase storage since i use it as a database".
    // I'll use 'documents' bucket for research files to keep them separate, or 'public' if generic.
    // Let's stick to 'images' for images and maybe 'documents' for files. 
    // But to be safe and simple, I'll use 'uploads' or similar if I can create it, or just 'images' if it allows all files.
    // Actually, the user specifically mentioned "image upload feature". 
    // But I should probably update research upload too since I changed the multer storage to memory.
    // I will use 'documents' bucket for research. If it doesn't exist, it might fail. 
    // Safest bet: Check if I can list buckets? No.
    // I'll assume 'documents' exists or use 'images' if I have to. 
    // Let's try 'documents'.

    const file_url = await uploadToSupabase(req.file, 'research-pdfs');

    const { data, error } = await supabase
      .from('researches')
      .insert([
        {
          title,
          abstract,
          authors: JSON.parse(authors), // Convert JSON string to array
          journal,
          file_url,
          publication_date,
        }
      ])
      .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
      await indexResearch(data[0]);
    } catch (indexError) {
      console.error('Search index error (research create):', indexError);
    }

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating research:', error);
    throw new AppError('Failed to create research', 500, 'ADMIN_RESEARCH_CREATE_FAILED');
  }
}));

// Update research
router.put('/research/:id', authenticateToken, uploadLimiter, upload.single('research_file'), validateUploadedFile(['pdf', 'doc', 'docx']), validateResearch, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { title, authors, journal, publication_date } = req.body;
    const abstract = sanitizeContent(req.body.abstract);

    // Get the current research to check if file exists
    const { data: existingResearch, error: fetchError } = await supabase
      .from('researches')
      .select('file_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    let file_url = existingResearch.file_url;

    // Update file if a new one was uploaded
    if (req.file) {
      file_url = await uploadToSupabase(req.file, 'research-pdfs');
    }

    const { data, error } = await supabase
      .from('researches')
      .update({
        title,
        abstract,
        authors: JSON.parse(authors), // Convert JSON string to array
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
    } catch (indexError) {
      console.error('Search index error (research update):', indexError);
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating research:', error);
    throw new AppError('Failed to update research', 500, 'ADMIN_RESEARCH_UPDATE_FAILED');
  }
}));

// Delete research
router.delete('/research/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Delete the research
    const { error } = await supabase
      .from('researches')
      .delete()
      .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    try {
      await removeResearch(id);
    } catch (indexError) {
      console.error('Search index error (research delete):', indexError);
    }

    res.json({ message: 'Research deleted successfully' });
  } catch (error) {
    console.error('Error deleting research:', error);
    throw new AppError('Failed to delete research', 500, 'ADMIN_RESEARCH_DELETE_FAILED');
  }
}));

// Authors management routes

// Create new author
router.post('/authors', authenticateToken, uploadLimiter, upload.single('image'), validateUploadedFile(['jpg', 'jpeg', 'png']), asyncHandler(async (req, res) => {
  try {
    const {
      name,
      bio,
      specialization,
      experience_years,
      education,
      location,
      email,
      website,
      is_active
    } = req.body;

    let image = '';

    // If file was uploaded
    if (req.file) {
      image = await uploadToSupabase(req.file, 'images');
    } else if (req.body.image_url) {
      // If external URL was provided
      image = req.body.image_url;
    } else {
      return res.status(400).json({ error: 'Author image is required' });
    }

    const { data, error } = await supabase
      .from('authors')
      .insert([
        {
          name,
          bio,
          image,
          specialization,
          experience_years: parseInt(experience_years) || 1,
          education,
          location,
          email: email || null,
          website: website || null,
          is_active: is_active === 'true',
        }
      ])
      .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating author:', error);
    throw new AppError('Failed to create author', 500, 'ADMIN_AUTHOR_CREATE_FAILED');
  }
}));

// Update author
router.put('/authors/:id', authenticateToken, uploadLimiter, upload.single('image'), validateUploadedFile(['jpg', 'jpeg', 'png']), asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      bio,
      specialization,
      experience_years,
      education,
      location,
      email,
      website,
      is_active
    } = req.body;

    // Get the current author to check if image exists
    const { data: existingAuthor, error: fetchError } = await supabase
      .from('authors')
      .select('image')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    let image = existingAuthor.image;

    // Update image if a new one was uploaded
    if (req.file) {
      image = await uploadToSupabase(req.file, 'images');
    } else if (req.body.image_url) {
      image = req.body.image_url;
    }

    const { data, error } = await supabase
      .from('authors')
      .update({
        name,
        bio,
        image,
        specialization,
        experience_years: parseInt(experience_years) || 1,
        education,
        location,
        email: email || null,
        website: website || null,
        is_active: is_active === 'true',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating author:', error);
    throw new AppError('Failed to update author', 500, 'ADMIN_AUTHOR_UPDATE_FAILED');
  }
}));

// Delete author
router.delete('/authors/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Delete the author
    const { error } = await supabase
      .from('authors')
      .delete()
      .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.json({ message: 'Author deleted successfully' });
  } catch (error) {
    console.error('Error deleting author:', error);
    throw new AppError('Failed to delete author', 500, 'ADMIN_AUTHOR_DELETE_FAILED');
  }
}));

// Get License Code Report
router.get('/reports/licenses', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Check if user is admin (re-using the logic from other routes or middleware if available)
    // The file imports checkLoginAllowed but not requireAdmin middleware explicitly in the imports shown?
    // Wait, line 10 imports: authenticateToken, trackLoginAttempt, checkLoginAllowed.
    // It does NOT import requireAdmin.
    // But line 134 does a manual check.
    // I will do a manual check here to be safe and consistent with the file style.

    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('admin_license_quiz_report')
      .select('*', { count: 'exact' });

    if (search) {
      const sanitizedSearch = sanitizeSearchInput(search);
      if (sanitizedSearch) {
        query = query.or(`code.ilike.%${sanitizedSearch}%,user_email.ilike.%${sanitizedSearch}%`);
      }
    }

    const { data, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('redeemed_at', { ascending: false });

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.json({
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching license report:', error);
    throw new AppError('Failed to fetch report', 500, 'ADMIN_LICENSE_REPORT_FAILED');
  }
}));

// Generate License Codes (supports typed credit collections)
router.post('/codes/generate', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { amount, credit_value, prefix, credit_type, video_minutes, article_count, research_count, credit_type_id } = req.body;

    // Validate inputs
    if (!amount || amount < 1 || amount > 100) {
      return res.status(400).json({ error: 'Amount must be between 1 and 100' });
    }

    // If typed, credit_type_id is required
    if (credit_type === 'typed' && !credit_type_id) {
      return res.status(400).json({ error: 'credit_type_id is required for typed codes' });
    }

    // Check admin permissions
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Determine prefix: if typed, use credit type's prefix
    let resolvedPrefix = prefix || 'GIFT';
    if (credit_type === 'typed' && credit_type_id) {
      const { data: typeData } = await supabase
        .from('credit_types')
        .select('prefix')
        .eq('id', credit_type_id)
        .single();
      if (typeData?.prefix) {
        resolvedPrefix = typeData.prefix;
      }
    }

    // Call v3 RPC which supports credit_type_id
    const { data, error } = await supabase
      .rpc('generate_license_codes_v3', {
        p_amount: parseInt(amount),
        p_credit_value: parseInt(credit_value || 0),
        p_prefix: resolvedPrefix,
        p_credit_type: credit_type || 'universal',
        p_video_minutes: parseInt(video_minutes || 0),
        p_article_count: parseInt(article_count || 0),
        p_research_count: parseInt(research_count || 0),
        p_credit_type_id: credit_type_id || null
      });

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    res.json({
      message: 'Codes generated successfully',
      codes: data
    });

  } catch (error) {
    console.error('Error generating codes:', error);
    throw new AppError('Failed to generate codes', 500, 'ADMIN_CODES_GENERATE_FAILED');
  }
}));

// =====================
// Categories Management
// =====================

// Get all categories
router.get('/categories', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      throw new AppError('Failed to fetch categories', 500, 'ADMIN_CATEGORIES_FETCH_FAILED');
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new AppError('Failed to fetch categories', 500, 'ADMIN_CATEGORIES_FETCH_FAILED');
  }
}));

// Create category
router.post('/categories', authenticateToken, asyncHandler(async (req, res) => {
  try {
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
      throw error;
    }

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    throw new AppError('Failed to create category', 500, 'ADMIN_CATEGORY_CREATE_FAILED');
  }
}));

// Update category
router.put('/categories/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
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

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    throw new AppError('Failed to update category', 500, 'ADMIN_CATEGORY_UPDATE_FAILED');
  }
}));

// Delete category
router.delete('/categories/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    throw new AppError('Failed to delete category', 500, 'ADMIN_CATEGORY_DELETE_FAILED');
  }
}));

router.get('/codes/history',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt()
  ],
  asyncHandler(async (req, res) => {
    try {
      // 1. Validation Check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 2. Optimized Query with Count
      const { data, error, count } = await supabase
        .from('license_codes')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

      res.json({
        data,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching codes history:', error);
      throw new AppError('Failed to fetch codes history', 500, 'ADMIN_CODES_HISTORY_FAILED');
    }
  }));


// =====================
// Credit Types Management
// =====================

// Get all credit types
router.get('/credit-types', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_types')
      .select('*, credit_type_courses(course_id)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch credit types', 500, 'ADMIN_CREDIT_TYPES_FETCH_FAILED');
    }

    // Reshape to include course_ids array
    const result = data.map(ct => ({
      ...ct,
      course_ids: (ct.credit_type_courses || []).map(c => c.course_id),
      credit_type_courses: undefined
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching credit types:', error);
    throw new AppError('Failed to fetch credit types', 500, 'ADMIN_CREDIT_TYPES_FETCH_FAILED');
  }
}));

// Get single credit type with courses
router.get('/credit-types/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('credit_types')
      .select('*, credit_type_courses(course_id)')
      .eq('id', id)
      .single();

    if (error) {
      throw new AppError('Failed to fetch credit type', 500, 'ADMIN_CREDIT_TYPE_FETCH_FAILED');
    }

    res.json({
      ...data,
      course_ids: (data.credit_type_courses || []).map(c => c.course_id),
      credit_type_courses: undefined
    });
  } catch (error) {
    console.error('Error fetching credit type:', error);
    throw new AppError('Failed to fetch credit type', 500, 'ADMIN_CREDIT_TYPE_FETCH_FAILED');
  }
}));

// Create credit type
router.post('/credit-types', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { name, description, prefix, is_active, course_ids } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Credit type name is required' });
    }
    if (!prefix || !prefix.trim()) {
      return res.status(400).json({ error: 'Credit type prefix is required' });
    }

    // Create the credit type
    const { data: creditType, error } = await supabase
      .from('credit_types')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        prefix: prefix.trim().toUpperCase(),
        is_active: is_active !== false
      }])
      .select()
      .single();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    // Link courses if provided
    if (course_ids && Array.isArray(course_ids) && course_ids.length > 0) {
      const courseLinks = course_ids.map(courseId => ({
        credit_type_id: creditType.id,
        course_id: courseId
      }));

      const { error: linkError } = await supabase
        .from('credit_type_courses')
        .insert(courseLinks);

      if (linkError) {
        console.error('Error linking courses:', linkError);
      }
    }

    res.status(201).json({
      ...creditType,
      course_ids: course_ids || []
    });
  } catch (error) {
    console.error('Error creating credit type:', error);
    throw new AppError('Failed to create credit type', 500, 'ADMIN_CREDIT_TYPE_CREATE_FAILED');
  }
}));

// Update credit type
router.put('/credit-types/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, prefix, is_active, course_ids } = req.body;

    const { data: creditType, error } = await supabase
      .from('credit_types')
      .update({
        name: name?.trim(),
        description: description?.trim() || null,
        prefix: prefix?.trim().toUpperCase(),
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');

    // If course_ids provided, replace the full collection
    if (course_ids && Array.isArray(course_ids)) {
      // Remove existing links
      await supabase
        .from('credit_type_courses')
        .delete()
        .eq('credit_type_id', id);

      // Insert new links
      if (course_ids.length > 0) {
        const courseLinks = course_ids.map(courseId => ({
          credit_type_id: id,
          course_id: courseId
        }));

        const { error: linkError } = await supabase
          .from('credit_type_courses')
          .insert(courseLinks);

        if (linkError) {
          console.error('Error updating course links:', linkError);
        }
      }
    }

    res.json({
      ...creditType,
      course_ids: course_ids || []
    });
  } catch (error) {
    console.error('Error updating credit type:', error);
    throw new AppError('Failed to update credit type', 500, 'ADMIN_CREDIT_TYPE_UPDATE_FAILED');
  }
}));

// Delete credit type
router.delete('/credit-types/:id', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('credit_types')
      .delete()
      .eq('id', id);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json({ message: 'Credit type deleted successfully' });
  } catch (error) {
    console.error('Error deleting credit type:', error);
    throw new AppError('Failed to delete credit type', 500, 'ADMIN_CREDIT_TYPE_DELETE_FAILED');
  }
}));

// Add courses to a credit type
router.post('/credit-types/:id/courses', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { course_ids } = req.body;

    if (!course_ids || !Array.isArray(course_ids) || course_ids.length === 0) {
      return res.status(400).json({ error: 'course_ids array is required' });
    }

    const courseLinks = course_ids.map(courseId => ({
      credit_type_id: id,
      course_id: courseId
    }));

    const { data, error } = await supabase
      .from('credit_type_courses')
      .upsert(courseLinks, { onConflict: 'credit_type_id,course_id' })
      .select();

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json({ message: 'Courses added successfully', data });
  } catch (error) {
    console.error('Error adding courses to credit type:', error);
    throw new AppError('Failed to add courses', 500, 'ADMIN_CREDIT_TYPE_ADD_COURSES_FAILED');
  }
}));

// Remove a course from a credit type
router.delete('/credit-types/:id/courses/:courseId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id, courseId } = req.params;

    const { error } = await supabase
      .from('credit_type_courses')
      .delete()
      .eq('credit_type_id', id)
      .eq('course_id', courseId);

    if (error) throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
    res.json({ message: 'Course removed from credit type' });
  } catch (error) {
    console.error('Error removing course from credit type:', error);
    throw new AppError('Failed to remove course', 500, 'ADMIN_CREDIT_TYPE_REMOVE_COURSE_FAILED');
  }
}));

export default router;
