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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// Admin authentication - FIXED
// Admin authentication with rate limiting and security
router.post('/login', authLimiter, checkLoginAllowed, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      trackLoginAttempt(email || req.ip, false);
      return res.status(400).json({ 
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

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
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', authData.user.id)
      .single();

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
router.post('/articles', authenticateToken, uploadLimiter, upload.single('cover_image'), validateUploadedFile(['jpg', 'jpeg', 'png']), validateArticle, async (req, res) => {
  try {
    const { title, excerpt, content, author, tags, is_featured } = req.body;
    
    let cover_image = '';
    
    // If file was uploaded
    if (req.file) {
      cover_image = `/uploads/${req.file.filename}`;
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
      cover_image = `/uploads/${req.file.filename}`;
      
      // Delete old image if it's a local file
      if (existingArticle.cover_image.startsWith('/uploads/')) {
        const oldImagePath = path.join(__dirname, '..', '..', existingArticle.cover_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
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
    
    // Delete the cover image if it's a local file
    if (article.cover_image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '..', '..', article.cover_image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
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
    
    const file_url = `/uploads/${req.file.filename}`;
    
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
      file_url = `/uploads/${req.file.filename}`;
      
      // Delete old file if it's a local file
      if (existingResearch.file_url.startsWith('/uploads/')) {
        const oldFilePath = path.join(__dirname, '..', '..', existingResearch.file_url);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
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
    
    // Get the research to check if it has a local file to delete
    const { data: research, error: fetchError } = await supabase
      .from('researches')
      .select('file_url')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Delete the research
    const { error } = await supabase
      .from('researches')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Delete the file if it's a local file
    if (research.file_url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', '..', research.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
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
      image = `/uploads/${req.file.filename}`;
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
      image = `/uploads/${req.file.filename}`;
      
      // Delete old image if it's a local file
      if (existingAuthor.image.startsWith('/uploads/')) {
        const oldImagePath = path.join(__dirname, '..', '..', existingAuthor.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
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
    
    // Get the author to check if it has a local image to delete
    const { data: author, error: fetchError } = await supabase
      .from('authors')
      .select('image')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Delete the author
    const { error } = await supabase
      .from('authors')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Delete the image if it's a local file
    if (author.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '..', '..', author.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    res.json({ message: 'Author deleted successfully' });
  } catch (error) {
    console.error('Error deleting author:', error);
    res.status(500).json({ error: 'Failed to delete author' });
  }
});

export default router;