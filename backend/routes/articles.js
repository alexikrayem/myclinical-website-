import express from 'express';
import multer from "multer";
import fs from "fs";
import path from "path";
import { getGenerativeModel } from '../config/gemini.js';
import pdfParse from "pdf-parse";
import { aiLimiter, searchLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { validateUploadedFile } from '../middleware/fileValidation.js';
import { body, query, validationResult } from 'express-validator';
import { meiliSearch, orderByIdList } from '../services/search/searchService.js';
import { sanitizeSearchInput, buildFtsQuery } from '../utils/searchUtils.js';
import { ARTICLE_LIST_SELECT, ARTICLE_DETAIL_SELECT } from '../utils/queryFields.js';
import { optionalAuth } from '../middleware/userAuth.js';
import { supabaseAdmin, supabasePublic } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { applyPublicArticleFilter } from '../utils/articleVisibility.js';

import { validateFileSignature } from '../utils/fileValidation.js';

import logger from '../config/logger.js';

const router = express.Router();

// === File upload setup ===
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// === Gemini setup ===
const model = getGenerativeModel();
// AI artciles 
// AI artciles 
router.post("/generate-article",
  aiLimiter,
  [
    body('text').trim().notEmpty().withMessage('النص مطلوب').isLength({ max: 5000 }).withMessage('النص طويل جداً'),
    body('language').optional().isIn(['arabic', 'english']).withMessage('اللغة غير مدعومة'),
    body('articleType').optional().isIn(['article', 'research', 'summary']).withMessage('نوع المقال غير مدعوم')
  ],
  asyncHandler(async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { text, language = 'arabic', articleType = 'article' } = req.body;

      // Sanitize user input to prevent prompt injection:
      // - Strip triple-quote sequences which are the primary injection vector
      // - Cap length (already validated by express-validator, but defense in depth)
      const sanitizedText = text
        .replace(/"""/g, '') // block triple-quote escape attempts
        .replace(/'''/g, '')  // block single-quote variants
        .slice(0, 5000);

      // Use XML-style delimiters which are much harder to escape from than triple-quotes
      const prompt = `
      You are a professional medical writer. Your task is strictly limited to converting the provided input into a structured ${articleType} in ${language}.
      
      Instructions:
      1. Create a catchy Title.
      2. Write a concise Excerpt (summary).
      3. Format the Content in HTML (use <h2>, <p>, <ul>, <li>).
      4. Generate relevant Tags.
      5. Set Author as "AI".
      
      <user_input>
      ${sanitizedText}
      </user_input>
      
      Output ONLY valid JSON in this exact format, nothing else:
      {
        "title": "...",
        "excerpt": "...",
        "content": "...",
        "tags": ["..."],
        "author": "AI"
      }
      `;

      if (!model) {
        throw new AppError('AI model is not configured', 501, 'AI_DISABLED');
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Attempt to parse JSON response from AI
      let responseData;
      try {
        // Clean up markdown code blocks if present
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        responseData = JSON.parse(jsonStr);

        // Output validation: ensure the AI returned expected structure
        if (typeof responseData !== 'object' || !responseData.title || !responseData.content) {
          throw new Error('AI response missing required fields');
        }
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
      logger.error("Error generating article:", { error });
      throw new AppError('فشل توليد المقال', 500, 'AI_ARTICLE_GENERATE_FAILED');
    }
  }));

// === Generate article from file (PDF or TXT) ===
router.post("/generate-article-from-file", aiLimiter, uploadLimiter, upload.single("file"), validateUploadedFile(['pdf', 'txt']), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Deep Magic Byte Validation
    const signature = await validateFileSignature(req.file.buffer, [
      'application/pdf', 'text/plain'
    ]);

    // Note: TXT files might not have a signature detected by file-type, but we'll try
    if (!signature.valid && req.file.mimetype === 'application/pdf') {
      throw new AppError('Invalid PDF file signature', 400, 'INVALID_FILE_SIGNATURE');
    }

    const { language, articleType } = req.body;
    let text = "";

    if (req.file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text;
    } else {
      text = req.file.buffer.toString("utf-8");
    }

    const prompt = `حول النص التالي إلى مقال ${articleType} مكتوب بلغة ${language}. 
    اجعل الناتج يتضمن: 
    - عنوان
    - ملخص
    - محتوى منسق بـ HTML
    - كلمات مفتاحية
    - مؤلف (AI)
    النص: ${text}`;

    if (!model) {
      throw new AppError('AI model is not configured', 501, 'AI_DISABLED');
    }

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
    logger.error("Error generating article from file:", { error });
    throw new AppError('فشل توليد المقال من الملف', 500, 'AI_ARTICLE_FILE_FAILED');
  }
}));

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
router.get('/tags', cacheMiddleware(3600), asyncHandler(async (req, res) => {
  const { data, error } = await supabasePublic.rpc('get_public_article_tags');

  if (error) {
    throw new AppError('Failed to fetch tags', 500, 'ARTICLES_TAGS_FAILED');
  }

  const uniqueTags = (data || []).map(({ tag }) => tag).sort();

  res.json(uniqueTags);
}));

// Get latest articles grouped by tags
// GET /articles/by-tags?tags=tag1,tag2&limit=5
// If tags omitted, returns for ALL known tags
router.get('/by-tags', cacheMiddleware(300), asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  const parsedLimit = Math.min(parseInt(limit) || 5, 10);

  // Determine which tags to fetch
  let tagsToFetch;
  if (req.query.tags) {
    tagsToFetch = req.query.tags.split(',').map(t => t.trim()).filter(Boolean);
  } else {
    // Fetch all known tags
    const { data: tagData, error: tagError } = await supabasePublic.rpc('get_public_article_tags');
    if (tagError) {
      throw new AppError('Failed to fetch articles by tags', 500, 'ARTICLES_BY_TAGS_FAILED');
    }
    tagsToFetch = (tagData || []).map(({ tag }) => tag).sort();
  }

  // Fetch latest articles for each tag in parallel
  const results = {};
  await Promise.all(
    tagsToFetch.map(async (tag) => {
      const { data, error } = await applyPublicArticleFilter(supabasePublic
        .from('articles')
        .select('id, title, slug, excerpt, cover_image, publication_date, author, tags, article_type')
        .contains('tags', [tag]))
        .order('publication_date', { ascending: false })
        .limit(parsedLimit);

      if (error) {
        logger.error(`Error fetching articles for tag "${tag}":`, error);
        results[tag] = [];
      } else {
        results[tag] = data || [];
      }
    })
  );

  res.json(results);
}));

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
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid search parameters' });
    }

    const { tag, search, limit = 12, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    // Note: `dbQuery` is used instead of `query` to avoid shadowing the destructured `req.query` above.
    let dbQuery = applyPublicArticleFilter(supabasePublic.from('articles').select(`${ARTICLE_LIST_SELECT}`, { count: 'exact' }));

    // Tag filtering
    if (tag) {
      dbQuery = dbQuery.contains('tags', [tag]);
    }

    // Type filtering
    if (req.query.type) {
      dbQuery = dbQuery.eq('article_type', req.query.type);
    }

    // Full-text search using Postgres textSearch
    // Falls back to trigram similarity for Arabic text
    if (search) {
      const meiliResult = await meiliSearch('articles', search, {
        page,
        limit,
        filters: {
          ...(tag ? { tags: tag } : {}),
          ...(req.query.type ? { article_type: req.query.type } : {})
        }
      });

      if (meiliResult) {
        const ids = meiliResult.hits.map(hit => hit.id);
        const total = meiliResult.estimatedTotalHits || 0;

        if (!ids.length) {
          return res.json({
            data: [],
            pagination: {
              total,
              page: parseInt(page),
              limit: parseInt(limit),
              pages: Math.ceil(total / limit)
            }
          });
        }

        const { data: rows, error: fetchError } = await applyPublicArticleFilter(supabasePublic
          .from('articles')
          .select(ARTICLE_LIST_SELECT)
          .in('id', ids));

        if (fetchError) {
          throw new AppError('Failed to fetch articles', 500, 'ARTICLES_FETCH_FAILED');
        }

        const ordered = orderByIdList(rows, ids);
        return res.json({
          data: ordered,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
          }
        });
      }

      // Fallback: Use Supabase FTS for partial matches
      const ftsString = buildFtsQuery(search);
      if (ftsString) {
        dbQuery = dbQuery.or(
          `title.fts."${ftsString}",excerpt.fts."${ftsString}",author.fts."${ftsString}"`
        );
      }
    }

    const { data, error, count } = await dbQuery
      .order('publication_date', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      throw new AppError('Failed to fetch articles', 500, 'ARTICLES_FETCH_FAILED');
    }

    res.json({
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  }));

// Get featured articles
router.get('/featured', cacheMiddleware(600), asyncHandler(async (req, res) => {
  const { data: articles, error } = await applyPublicArticleFilter(supabasePublic
    .from('articles')
    .select(ARTICLE_LIST_SELECT)
    .eq('is_featured', true))
    .order('publication_date', { ascending: false })
    .limit(5);

  if (error) {
    throw new AppError('Failed to fetch featured articles', 500, 'ARTICLES_FEATURED_FAILED');
  }

  // Fetch author details for all featured articles in one query (Refactored to avoid N+1)
  const authorNames = [...new Set(articles.map(a => a.author))];
  const { data: authorsData } = await supabasePublic
    .from('authors')
    .select('name, image')
    .in('name', authorNames);

  const authorMap = new Map(authorsData?.map(a => [a.name, a.image]) || []);
  const defaultImage = 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2';

  const articlesWithAuthors = articles.map(article => ({
    ...article,
    author_image: authorMap.get(article.author) || defaultImage
  }));

  res.json(articlesWithAuthors);
}));

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
// Direct token access is the sole public path for approved unlisted articles.
router.get('/shared/:token', optionalAuth, asyncHandler(async (req, res) => {
  const { data: article, error } = await supabaseAdmin
    .from('articles')
    .select(ARTICLE_DETAIL_SELECT)
    .eq('share_token', req.params.token)
    .eq('status', 'approved')
    .eq('visibility', 'unlisted')
    .eq('audience', 'public')
    .single();
  if (error || !article) throw new NotFoundError('Article not found');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.json({ ...article, is_shared: true, is_preview: false, has_access: true });
}));

router.get('/:idOrSlug', optionalAuth, asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  let userId = req.user?.id || null;
  let hasAccess = false;

  // 1. Verify User if token exists
  if (!userId && token) {
    const { data: { user }, error } = await supabasePublic.auth.getUser(token);
    if (!error && user) {
      userId = user.id;
    }
  }

  // 2. Fetch Article by ID or slug
  // Check if idOrSlug looks like a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  let query = applyPublicArticleFilter(supabasePublic.from('articles').select(ARTICLE_DETAIL_SELECT));
  if (isUUID) {
    query = query.eq('id', idOrSlug);
  } else {
    query = query.eq('slug', idOrSlug);
  }

  const { data: article, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Article not found');
    }
    throw new AppError('Failed to fetch article', 500, 'ARTICLE_FETCH_FAILED');
  }

  // 3. Free content never needs a user-specific access lookup.
  if (article.credits_required === 0) {
    hasAccess = true;
  } else if (userId) {
    // Admin and explicit-access checks are independent, so issue them together.
    const [{ data: admin, error: adminError }, { data: access, error: accessError }] = await Promise.all([
      supabaseAdmin.from('admins').select('id').eq('id', userId).single(),
      supabaseAdmin.from('article_access').select('id').eq('user_id', userId).eq('article_id', article.id).single()
    ]);

    if (adminError && adminError.code !== 'PGRST116') {
      throw new AppError('Failed to check article access', 500, 'ARTICLE_ACCESS_CHECK_FAILED');
    }
    if (accessError && accessError.code !== 'PGRST116') {
      throw new AppError('Failed to check article access', 500, 'ARTICLE_ACCESS_CHECK_FAILED');
    }
    hasAccess = Boolean(admin || access);
  }

  // 4. Handle Content Delivery

  // Return truncated content (Peek) when no access
  const TRUNCATE_LENGTH = 600;
  let content = article.content;
  if (!hasAccess && article.content?.length > TRUNCATE_LENGTH) {
    const cutIndex = article.content.indexOf(' ', TRUNCATE_LENGTH);
    content = article.content.substring(0, cutIndex > 0 ? cutIndex : TRUNCATE_LENGTH) + '...';
  }

  const responsePayload = {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    content: hasAccess ? article.content : content,
    cover_image: article.cover_image,
    publication_date: article.publication_date,
    author: article.author,
    tags: article.tags,
    article_type: article.article_type,
    is_featured: article.is_featured,
    credits_required: article.credits_required,
    is_preview: !hasAccess,
    has_access: hasAccess
  };

  res.json(responsePayload);
}));

// Get related articles with smart scoring
router.get('/:id/related', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 3 } = req.query;

  // 1. Get current article details
  const { data: article, error: articleError } = await applyPublicArticleFilter(supabasePublic
    .from('articles')
    .select('tags, article_type, categories')
    .eq('id', id))
    .single();

  if (articleError) {
    throw new AppError('Failed to fetch related articles', 500, 'ARTICLES_RELATED_FAILED');
  }

  // 2. Fetch candidates (pool of potentially related items)
  // We fetch more than needed to sort them in memory
  // Strategy: Get items with overlapping tags OR same category
  const { data: candidates, error } = await applyPublicArticleFilter(supabasePublic
    .from('articles')
    .select('id, title, excerpt, cover_image, publication_date, author, tags, article_type')
    .neq('id', id) // Exclude current
    .overlaps('tags', article.tags || [])) // Must have at least one tag in common
    .limit(20); // Fetch pool of 20

  if (error) {
    throw new AppError('Failed to fetch related articles', 500, 'ARTICLES_RELATED_FAILED');
  }

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
    const { data: fallback } = await applyPublicArticleFilter(supabasePublic
      .from('articles')
      .select('id, title, excerpt, cover_image, publication_date, author, tags, article_type')
      .neq('id', id))
      .order('publication_date', { ascending: false })
      .limit(parseInt(limit) - finalResults.length);

    // Filter out duplicates
    const existingIds = new Set(finalResults.map(r => r.id));
    const uniqueFallback = (fallback || []).filter(r => !existingIds.has(r.id));

    finalResults = [...finalResults, ...uniqueFallback];
  }

  res.json(finalResults);
}));

export default router;
