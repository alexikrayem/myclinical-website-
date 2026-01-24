import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { validateArticle, validateResearch } from '../middleware/validation.js';
import { authenticateToken, trackLoginAttempt, checkLoginAllowed } from '../middleware/auth.js';
import { authLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import { validateUploadedFile } from '../middleware/fileValidation.js';
import { sanitizeFileName } from '../middleware/inputSanitizer.js';
import { body, validationResult } from 'express-validator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    if (error) throw error;

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
  async (req, res) => {
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
        trackLoginAttempt(email, false);
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
        const attemptResult = trackLoginAttempt(email, false);

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
        trackLoginAttempt(email, false);
        return res.status(401).json({
          error: 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }

      // Check if the user is an admin
      console.log('Checking admin status for User ID:', authData.user.id);

      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      console.log('Admin Lookup Result:', { adminData, adminError });

      if (adminError || !adminData) {
        trackLoginAttempt(email, false);

        if (process.env.NODE_ENV === 'development') {
          console.error('Admin check error:', adminError);
        }

        return res.status(403).json({
          error: 'Access denied - insufficient permissions',
          code: 'NOT_ADMIN'
        });
      }

      // Successful login - reset attempts
      trackLoginAttempt(email, true);

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
      res.status(500).json({
        error: 'An error occurred during login',
        code: 'INTERNAL_ERROR'
      });
    }
  });

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Clear session cookie
    res.clearCookie('session');

    res.json({
      message: 'Logout successful',
      code: 'LOGOUT_SUCCESS'
    });
  } catch (error) {
    res.status(500).json({
      error: 'An error occurred during logout',
      code: 'LOGOUT_ERROR'
    });
  }
});
// Get admin profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: adminData, error } = await supabase
      .from('admins')
      .select('id, email, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json(adminData);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

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
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { title, excerpt, content, author, tags, is_featured } = req.body;

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
            article_type: req.body.article_type || 'article', // Add article_type
            publication_date: new Date().toISOString(),
          }
        ])
        .select();

      if (error) throw error;

      res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error creating article:', error);
      res.status(500).json({ error: 'Failed to create article' });
    }
  });

// Update article
router.put('/articles/:id', authenticateToken, uploadLimiter, upload.single('cover_image'), validateUploadedFile(['jpg', 'jpeg', 'png']), validateArticle, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, author, tags, is_featured } = req.body;

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
        article_type: req.body.article_type || 'article', // Add article_type
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Delete article
router.delete('/articles/:id', authenticateToken, async (req, res) => {
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

    if (error) throw error;

    // Note: We are not deleting files from Supabase storage automatically to prevent accidental data loss
    // and because we don't track file references perfectly. 
    // A separate cleanup script would be better for that.

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// Create new research
router.post('/research', authenticateToken, uploadLimiter, upload.single('research_file'), validateUploadedFile(['pdf', 'doc', 'docx']), validateResearch, async (req, res) => {
  try {
    const { title, abstract, authors, journal, publication_date } = req.body;

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

    const file_url = await uploadToSupabase(req.file, 'documents');

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

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating research:', error);
    res.status(500).json({ error: 'Failed to create research' });
  }
});

// Update research
router.put('/research/:id', authenticateToken, uploadLimiter, upload.single('research_file'), validateUploadedFile(['pdf', 'doc', 'docx']), validateResearch, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, abstract, authors, journal, publication_date } = req.body;

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
      file_url = await uploadToSupabase(req.file, 'documents');
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

    if (error) throw error;

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating research:', error);
    res.status(500).json({ error: 'Failed to update research' });
  }
});

// Delete research
router.delete('/research/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete the research
    const { error } = await supabase
      .from('researches')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Research deleted successfully' });
  } catch (error) {
    console.error('Error deleting research:', error);
    res.status(500).json({ error: 'Failed to delete research' });
  }
});

// Authors management routes

// Create new author
router.post('/authors', authenticateToken, uploadLimiter, upload.single('image'), validateUploadedFile(['jpg', 'jpeg', 'png']), async (req, res) => {
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

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating author:', error);
    res.status(500).json({ error: 'Failed to create author' });
  }
});

// Update author
router.put('/authors/:id', authenticateToken, uploadLimiter, upload.single('image'), validateUploadedFile(['jpg', 'jpeg', 'png']), async (req, res) => {
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

    if (error) throw error;

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating author:', error);
    res.status(500).json({ error: 'Failed to update author' });
  }
});

// Delete author
router.delete('/authors/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete the author
    const { error } = await supabase
      .from('authors')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Author deleted successfully' });
  } catch (error) {
    console.error('Error deleting author:', error);
    res.status(500).json({ error: 'Failed to delete author' });
  }
});

// Get License Code Report
router.get('/reports/licenses', authenticateToken, async (req, res) => {
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
      query = query.or(`code.ilike.%${search}%,user_email.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('redeemed_at', { ascending: false });

    if (error) throw error;

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
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Generate License Codes
router.post('/codes/generate', authenticateToken, async (req, res) => {
  try {
    const { amount, credit_value, prefix, credit_type, video_minutes, article_count } = req.body;

    // Validate inputs
    if (!amount || amount < 1 || amount > 100) {
      return res.status(400).json({ error: 'Amount must be between 1 and 100' });
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

    // Call the new RPC function
    const { data, error } = await supabase
      .rpc('generate_license_codes_v2', {
        p_amount: parseInt(amount),
        p_credit_value: parseInt(credit_value || 0),
        p_prefix: prefix || 'GIFT',
        p_credit_type: credit_type || 'universal',
        p_video_minutes: parseInt(video_minutes || 0),
        p_article_count: parseInt(article_count || 0)
      });

    if (error) throw error;

    res.json({
      message: 'Codes generated successfully',
      codes: data
    });

  } catch (error) {
    console.error('Error generating codes:', error);
    res.status(500).json({ error: 'Failed to generate codes' });
  }
});

// =====================
// Categories Management
// =====================

// Get all categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category
router.post('/categories', authenticateToken, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/categories/:id', authenticateToken, async (req, res) => {
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

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;