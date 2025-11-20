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

// Get all unique tags
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

// Get all articles with advanced search
router.get('/',
  searchLimiter,
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

      // Simple search using ilike for better compatibility
      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%,author.ilike.%${search}%`);
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
router.get('/featured', async (req, res) => {
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

// Get single article by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Article not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Get related articles
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 3 } = req.query;

    // First get the article to get its tags
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('tags')
      .eq('id', id)
      .single();

    if (articleError) throw articleError;

    // Then get related articles based on tags
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .neq('id', id)
      .overlaps('tags', article.tags)
      .order('publication_date', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching related articles:', error);
    res.status(500).json({ error: 'Failed to fetch related articles' });
  }
});

export default router;