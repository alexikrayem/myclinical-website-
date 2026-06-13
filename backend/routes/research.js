import express from 'express';
import { cacheMiddleware } from '../middleware/cache.js';
import { sanitizeSearchInput, buildFtsQuery } from '../utils/searchUtils.js';
import { meiliSearch, orderByIdList } from '../services/search/searchService.js';
import { validate, schemas } from '../middleware/validation.js';
import { supabasePublic as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, NotFoundError } from '../utils/errors.js';

const router = express.Router();

// Get all research papers with advanced search
router.get('/', validate(schemas.researchList), asyncHandler(async (req, res) => {
  const { journal, search, limit, page } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase.from('researches').select('id, title, journal, abstract, publication_date, authors, is_featured', { count: 'exact' });

  // Journal filtering
  if (journal) {
    query = query.eq('journal', journal);
  }

  // Search with Meilisearch if available, fallback to ilike
  if (search) {
    const meiliResult = await meiliSearch('researches', search, {
      page,
      limit,
      filters: {
        ...(journal ? { journal } : {})
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
            page,
            limit,
            pages: Math.ceil(total / limit)
          }
        });
      }

      const { data: rows, error: fetchError } = await supabase
        .from('researches')
        .select('id, title, journal, abstract, publication_date, authors, is_featured')
        .in('id', ids);

      if (fetchError) {
        throw new AppError('Failed to fetch research papers', 500, 'RESEARCH_FETCH_FAILED');
      }

      const ordered = orderByIdList(rows, ids);
      return res.json({
        data: ordered,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    }

    const ftsString = buildFtsQuery(search);
    if (ftsString) {
      query = query.or(`title.fts."${ftsString}",abstract.fts."${ftsString}",journal.fts."${ftsString}"`);
    }
  }

  const { data, error, count } = await query
    .order('publication_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError('Failed to fetch research papers', 500, 'RESEARCH_FETCH_FAILED');
  }

  res.json({
    data,
    pagination: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    }
  });
}));

// Get featured research papers
router.get('/featured', cacheMiddleware(600), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('researches')
    .select('id, title, journal, abstract, publication_date, authors')
    .eq('is_featured', true)
    .order('publication_date', { ascending: false })
    .limit(4);

  if (error) {
    throw new AppError('Failed to fetch featured research papers', 500, 'RESEARCH_FEATURED_FAILED');
  }

  res.json(data);
}));

// Get single research paper by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('researches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Research paper not found');
    }
    throw new AppError('Failed to fetch research paper', 500, 'RESEARCH_FETCH_FAILED');
  }

  res.json(data);
}));

/**
 * @swagger
 * /research/{id}/related:
 *   get:
 *     summary: Get related research papers
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Research paper ID
 *     responses:
 *       200:
 *         description: List of related research papers
 */
router.get('/:id/related', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 3;

  // 1. Get current paper details to find related ones
  const { data: currentPaper, error: fetchError } = await supabase
    .from('researches')
    .select('journal, title, search_vector')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new AppError('Failed to fetch related research', 500, 'RESEARCH_RELATED_FAILED');
  }

  // 2. Find related papers
  // Strategy: Same journal OR similar title/content using full-text search
  let query = supabase
    .from('researches')
    .select('id, title, journal, publication_date, authors')
    .neq('id', id) // Exclude current paper
    .limit(limit);

  // If we have a journal, prioritize same journal
  if (currentPaper.journal) {
    query = query.eq('journal', currentPaper.journal);
  }

  const { data: related, error: relatedError } = await query;

  if (relatedError) {
    throw new AppError('Failed to fetch related research', 500, 'RESEARCH_RELATED_FAILED');
  }

  // If we didn't find enough related by journal, try FTS similarity (future improvement)
  // For now, this is a good start.

  res.json(related);
}));

// Get available journals
router.get('/journals/list', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('researches')
    .select('journal');

  if (error) {
    throw new AppError('Failed to fetch journals', 500, 'RESEARCH_JOURNALS_FAILED');
  }

  // Extract unique journal names
  const journals = [...new Set(data.map(item => item.journal))];

  res.json(journals);
}));

export default router;
