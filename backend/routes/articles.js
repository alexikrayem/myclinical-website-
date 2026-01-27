import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import multer from "multer";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { aiLimiter, searchLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { validateUploadedFile } from '../middleware/fileValidation.js';
import { body, query, validationResult } from 'express-validator';

dotenv.config();

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// === File upload setup ===
const upload = multer({ dest: "uploads/" });

// === Gemini setup ===
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// AI artciles 
// AI artciles 
router.post("/generate-article",
  aiLimiter,
  [
    body('text').trim().notEmpty().withMessage('النص مطلوب').isLength({ max: 5000 }).withMessage('النص طويل جداً'),
    body('language').optional().isIn(['arabic', 'english']).withMessage('اللغة غير مدعومة'),
    body('articleType').optional().isIn(['article', 'research', 'summary']).withMessage('نوع المقال غير مدعوم')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { text, language = 'arabic', articleType = 'article' } = req.body;

      // Secure prompt with delimiters to prevent injection
      const prompt = `
      You are a professional medical writer.
      Task: Convert the following input text into a structured ${articleType} in ${language}.
      
      Instructions:
      1. Create a catchy Title.
      2. Write a concise Excerpt (summary).
      3. Format the Content in HTML (use <h2>, <p>, <ul>, <li>).
      4. Generate relevant Tags.
      5. Set Author as "AI".
      
      Input Text:
      """
      ${text.replace(/"/g, "'")}
      """
      
      Output JSON format:
      {
        "title": "...",
        "excerpt": "...",
        "content": "...",
        "tags": ["..."],
        "author": "AI"
      }
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Attempt to parse JSON response from AI
      let responseData;
      try {
        // Clean up markdown code blocks if present
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        responseData = JSON.parse(jsonStr);
      } catch (e) {
        // Fallback if AI doesn't return valid JSON
        responseData = {
          title: "مقال مولد",
          excerpt: responseText.slice(0, 150),
          content: responseText,
          tags: ["ذكاء اصطناعي", "مقال"],
          author: "AI",
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("Error generating article:", error);
      res.status(500).json({ error: "فشل توليد المقال" });
    }
  });

// === Generate article from file (PDF or TXT) ===
router.post("/generate-article-from-file", aiLimiter, uploadLimiter, upload.single("file"), validateUploadedFile(['pdf', 'txt']), async (req, res) => {
  try {
    const { language, articleType } = req.body;
    const filePath = req.file.path;

    let text = "";

    if (req.file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      text = fs.readFileSync(filePath, "utf-8");
    }

    fs.unlinkSync(filePath); // clean up after upload

    const prompt = `حول النص التالي إلى مقال ${articleType} مكتوب بلغة ${language}. 
    اجعل الناتج يتضمن: 
    - عنوان
    - ملخص
    - محتوى منسق بـ HTML
    - كلمات مفتاحية
    - مؤلف (AI)
    النص: ${text}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({
      title: "مقال مولد من ملف",
      excerpt: response.slice(0, 150),
      content: response,
      tags: ["ذكاء اصطناعي", "ملف", "مقال"],
      author: "AI",
    });
  } catch (error) {
    console.error("Error generating article from file:", error);
    res.status(500).json({ error: "فشل توليد المقال من الملف" });
  }
});

/**
 * @swagger
 * /articles/tags:
 *   get:
 *     summary: Get all unique tags
 *     tags: [Articles]
 *     responses:
 *       200:
 *         description: List of unique tags
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.get('/tags', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('tags');

    if (error) throw error;

    // Flatten tags array and get unique values
    const allTags = data.flatMap(article => article.tags);
    const uniqueTags = [...new Set(allTags)].sort();

    res.json(uniqueTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

/**
 * @swagger
 * /articles:
 *   get:
 *     summary: Get all articles with pagination and search
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, excerpt, author
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [article, clinical_case]
 *         description: Filter by article type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of articles per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Paginated list of articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */

// Get all articles with advanced search
router.get('/',
  searchLimiter,
  cacheMiddleware(300), // Cache for 5 minutes
  [
    query('tag').optional().trim().escape(),
    query('search').optional().trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid search parameters' });
      }

      const { tag, search, limit = 12, page = 1 } = req.query;
      const offset = (page - 1) * limit;

      let query = supabase.from('articles').select('*', { count: 'exact' });

      // Tag filtering
      if (tag) {
        query = query.contains('tags', [tag]);
      }

      // Type filtering (default to 'article' if not specified, or allow fetching all?)
      // For now, let's allow optional filtering. If passed, filter.
      // If client page needs specific type, it will pass it.
      if (req.query.type) {
        query = query.eq('article_type', req.query.type);
      } else {
        // Default behavior: show everything or just articles?
        // Existing behavior showed everything. Let's keep it but arguably should filter by 'article' by default?
        // No, let's keep it flexible.
      }

      // Full-text search using Postgres textSearch
      // Falls back to trigram similarity for Arabic text
      if (search) {
        // Use Supabase textSearch for full-text search
        // Also add ilike as fallback for partial matches
        query = query.or(
          `title.ilike.%${search}%,excerpt.ilike.%${search}%,author.ilike.%${search}%`
        );

        // For better results, we can also use the search_vector column if available
        // This requires the fulltext_search migration to be applied
      }

      const { data, error, count } = await query
        .order('publication_date', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

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
      console.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Failed to fetch articles' });
    }
  });

// Get featured articles
router.get('/featured', cacheMiddleware(600), async (req, res) => {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_featured', true)
      .order('publication_date', { ascending: false })
      .limit(5);

    if (error) throw error;

    // Fetch author details for each article
    const articlesWithAuthors = await Promise.all(articles.map(async (article) => {
      try {
        const { data: authorData } = await supabase
          .from('authors')
          .select('image')
          .eq('name', article.author)
          .single();

        return {
          ...article,
          author_image: authorData?.image || 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2' // Default image
        };
      } catch (err) {
        // If author fetch fails, return article with default image
        return {
          ...article,
          author_image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'
        };
      }
    }));

    res.json(articlesWithAuthors);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ error: 'Failed to fetch featured articles' });
  }
});

/**
 * @swagger
 * /articles/{idOrSlug}:
 *   get:
 *     summary: Get single article by ID or slug
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Article ID (UUID) or slug
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Article details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Article'
 *       404:
 *         description: Article not found
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    let userId = null;
    let hasAccess = false;

    // 1. Verify User if token exists
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // 2. Fetch Article by ID or slug
    // Check if idOrSlug looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    let query = supabase.from('articles').select('*');
    if (isUUID) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data: article, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Article not found' });
      }
      throw error;
    }

    // 3. Check Access (if user is logged in)
    if (userId) {
      // Check for Admin
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('id', userId)
        .single();

      if (admin) {
        hasAccess = true;
      } else {
        // Check Article Access table
        const { data: access } = await supabase
          .from('article_access')
          .select('id')
          .eq('user_id', userId)
          .eq('article_id', article.id)
          .single();

        if (access) hasAccess = true;
      }
    }

    // 4. Handle Content Delivery
    // If article is free (credits_required = 0) everyone has access
    if (article.credits_required === 0) hasAccess = true;

    if (hasAccess) {
      // Return full content
      res.json({
        ...article,
        is_preview: false,
        has_access: true
      });
    } else {
      // Return truncated content (Peek)
      // Truncate at ~600 chars, try to cut at a space
      const TRUNCATE_LENGTH = 600;
      let truncatedContent = article.content;

      if (article.content.length > TRUNCATE_LENGTH) {
        const cutIndex = article.content.indexOf(' ', TRUNCATE_LENGTH);
        truncatedContent = article.content.substring(0, cutIndex > 0 ? cutIndex : TRUNCATE_LENGTH) + '...';
      }

      res.json({
        ...article,
        content: truncatedContent, // Hidden content
        is_preview: true,
        has_access: false
      });
    }
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Get related articles with smart scoring
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 3 } = req.query;

    // 1. Get current article details
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('tags, article_type, categories')
      .eq('id', id)
      .single();

    if (articleError) throw articleError;

    // 2. Fetch candidates (pool of potentially related items)
    // We fetch more than needed to sort them in memory
    // Strategy: Get items with overlapping tags OR same category
    const { data: candidates, error } = await supabase
      .from('articles')
      .select('id, title, excerpt, cover_image, publication_date, author, tags, article_type')
      .neq('id', id) // Exclude current
      .overlaps('tags', article.tags || []) // Must have at least one tag in common
      .limit(20); // Fetch pool of 20

    if (error) throw error;

    // 3. Score and Sort
    const scoredCandidates = candidates.map(candidate => {
      let score = 0;

      // Rule 1: Same type (e.g. Clinical Case) gets big boost
      if (candidate.article_type === article.article_type) {
        score += 10;
      }

      // Rule 2: Tag overlap count
      const sharedTags = candidate.tags.filter(t => article.tags.includes(t));
      score += (sharedTags.length * 5);

      return { ...candidate, score };
    });

    // Sort by score desc, then by date desc
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.publication_date) - new Date(a.publication_date);
    });

    // 4. Fallback if not enough results
    let finalResults = scoredCandidates.slice(0, parseInt(limit));

    // If we have fewer than requested, fill with recent articles
    if (finalResults.length < parseInt(limit)) {
      const { data: fallback } = await supabase
        .from('articles')
        .select('id, title, excerpt, cover_image, publication_date, author, tags, article_type')
        .neq('id', id)
        .order('publication_date', { ascending: false })
        .limit(parseInt(limit) - finalResults.length);

      // Filter out duplicates
      const existingIds = new Set(finalResults.map(r => r.id));
      const uniqueFallback = (fallback || []).filter(r => !existingIds.has(r.id));

      finalResults = [...finalResults, ...uniqueFallback];
    }

    res.json(finalResults);
  } catch (error) {
    console.error('Error fetching related articles:', error);
    res.status(500).json({ error: 'Failed to fetch related articles' });
  }
});

export default router;