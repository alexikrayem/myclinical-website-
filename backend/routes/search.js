import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { query, validationResult } from 'express-validator';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { sanitizeSearchInput } from '../utils/searchUtils.js';
import { ensureMeiliIndexes, getMeiliClient, isMeiliEnabled } from '../services/search/meiliClient.js';
import { normalizeQuery } from '../services/search/normalize.js';
import { getHitScore, orderByIdList } from '../services/search/searchService.js';
import { MERGED_FETCH_CAP, SEARCH_TYPE_WEIGHTS } from '../services/search/searchConfig.js';

dotenv.config();

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TYPE_MAP = {
  article: 'articles',
  articles: 'articles',
  research: 'researches',
  researches: 'researches',
  course: 'courses',
  courses: 'courses'
};

const DEFAULT_TYPES = ['articles', 'researches', 'courses'];

function normalizeTypes(typeParam) {
  if (!typeParam) return DEFAULT_TYPES;
  const parts = String(typeParam)
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  const mapped = parts.map(part => TYPE_MAP[part]).filter(Boolean);
  return mapped.length ? [...new Set(mapped)] : DEFAULT_TYPES;
}

function computeMergedScores(hits, typeKey) {
  if (!hits?.length) return new Map();
  const scores = hits.map((hit, index) => getHitScore(hit, index));
  const maxScore = Math.max(...scores, 1);
  const weight = SEARCH_TYPE_WEIGHTS[typeKey] || 1;
  const map = new Map();
  hits.forEach((hit, index) => {
    map.set(hit.id, (scores[index] / maxScore) * weight);
  });
  return map;
}

function sortMergedResults(items) {
  return items.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    const dateA = a.publication_date ? new Date(a.publication_date).getTime() : 0;
    const dateB = b.publication_date ? new Date(b.publication_date).getTime() : 0;
    return dateB - dateA;
  });
}

async function fetchArticles(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, excerpt, cover_image, author, tags, is_featured, publication_date, article_type, slug')
    .in('id', ids);
  if (error) throw error;
  return orderByIdList(data, ids);
}

async function fetchResearch(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('researches')
    .select('id, title, journal, abstract, publication_date, authors')
    .in('id', ids);
  if (error) throw error;
  return orderByIdList(data, ids);
}

async function fetchCourses(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('video_courses')
    .select('id, title, description, cover_image, publication_date, author, categories, is_featured, credits_required, rating, total_students, duration, level')
    .in('id', ids);
  if (error) throw error;
  return orderByIdList(data, ids);
}

router.get('/',
  searchLimiter,
  [
    query('search').optional().trim(),
    query('q').optional().trim(),
    query('type').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid search parameters' });
      }

      const rawQuery = req.query.search || req.query.q;
      if (!rawQuery || !rawQuery.trim()) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const offset = (page - 1) * limit;
      const types = normalizeTypes(req.query.type);
      const targetSize = Math.min(limit * page, MERGED_FETCH_CAP);

      if (isMeiliEnabled()) {
        try {
          const client = getMeiliClient();
          await ensureMeiliIndexes();

          const queries = types.map(type => ({
            indexUid: type,
            q: normalizeQuery(rawQuery),
            limit: targetSize,
            showRankingScore: true
          }));

          const multiResult = await client.multiSearch({ queries });
          const resultsByType = {};
          let combined = [];
          let totalCombined = 0;

          const meta = types.map((typeKey, index) => {
            const result = multiResult.results[index];
            return {
              typeKey,
              result,
              hits: result?.hits || [],
              ids: (result?.hits || []).map(hit => hit.id),
              total: result?.estimatedTotalHits || 0
            };
          });

          const fetchPromises = meta.map(entry => {
            if (entry.typeKey === 'articles') return fetchArticles(entry.ids);
            if (entry.typeKey === 'researches') return fetchResearch(entry.ids);
            if (entry.typeKey === 'courses') return fetchCourses(entry.ids);
            return Promise.resolve([]);
          });

          const fetchedResults = await Promise.all(fetchPromises);

          meta.forEach((entry, index) => {
            const items = fetchedResults[index] || [];
            totalCombined += entry.total;

            const scoreMap = computeMergedScores(entry.hits, entry.typeKey);
            const mergedItems = items.map(item => ({
              ...item,
              type: entry.typeKey,
              _score: scoreMap.get(item.id) || 0
            }));

            const pagedItems = items.slice(offset, offset + limit);
            resultsByType[entry.typeKey] = {
              data: pagedItems,
              pagination: {
                total: entry.total,
                page,
                limit,
                pages: Math.ceil(entry.total / limit)
              }
            };

            combined = combined.concat(mergedItems);
          });

          const mergedSorted = sortMergedResults(combined);
          const mergedPage = mergedSorted.slice(offset, offset + limit);

          return res.json({
            query: rawQuery,
            pagination: {
              total: totalCombined,
              page,
              limit,
              pages: Math.ceil(totalCombined / limit)
            },
            results: mergedPage,
            byType: resultsByType
          });
        } catch (meiliError) {
          console.error('Meilisearch unified search failed, falling back:', meiliError);
        }
      }

      // Fallback: Supabase ilike search
      const sanitized = sanitizeSearchInput(rawQuery);
      const resultsByType = {};
      let combined = [];
      let totalCombined = 0;

      const tasks = [];
      if (types.includes('articles')) {
        tasks.push(
          supabase
            .from('articles')
            .select('id, title, excerpt, cover_image, author, tags, is_featured, publication_date, article_type, slug', { count: 'exact' })
            .or(`title.ilike.%${sanitized}%,excerpt.ilike.%${sanitized}%,author.ilike.%${sanitized}%`)
            .order('publication_date', { ascending: false })
            .range(offset, offset + limit - 1)
        );
      } else {
        tasks.push(Promise.resolve({ data: [], count: 0 }));
      }

      if (types.includes('researches')) {
        tasks.push(
          supabase
            .from('researches')
            .select('id, title, journal, abstract, publication_date, authors', { count: 'exact' })
            .or(`title.ilike.%${sanitized}%,abstract.ilike.%${sanitized}%,journal.ilike.%${sanitized}%`)
            .order('publication_date', { ascending: false })
            .range(offset, offset + limit - 1)
        );
      } else {
        tasks.push(Promise.resolve({ data: [], count: 0 }));
      }

      if (types.includes('courses')) {
        tasks.push(
          supabase
            .from('video_courses')
            .select('id, title, description, cover_image, publication_date, author, categories, is_featured, credits_required, rating, total_students, duration, level', { count: 'exact' })
            .or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%,author.ilike.%${sanitized}%`)
            .order('publication_date', { ascending: false })
            .range(offset, offset + limit - 1)
        );
      } else {
        tasks.push(Promise.resolve({ data: [], count: 0 }));
      }

      const [articlesRes, researchRes, coursesRes] = await Promise.all(tasks);

      if (types.includes('articles')) {
        totalCombined += articlesRes.count || 0;
        resultsByType.articles = {
          data: articlesRes.data || [],
          pagination: {
            total: articlesRes.count || 0,
            page,
            limit,
            pages: Math.ceil((articlesRes.count || 0) / limit)
          }
        };
        combined = combined.concat((articlesRes.data || []).map(item => ({ ...item, type: 'articles', _score: 0 })));
      }

      if (types.includes('researches')) {
        totalCombined += researchRes.count || 0;
        resultsByType.researches = {
          data: researchRes.data || [],
          pagination: {
            total: researchRes.count || 0,
            page,
            limit,
            pages: Math.ceil((researchRes.count || 0) / limit)
          }
        };
        combined = combined.concat((researchRes.data || []).map(item => ({ ...item, type: 'researches', _score: 0 })));
      }

      if (types.includes('courses')) {
        totalCombined += coursesRes.count || 0;
        resultsByType.courses = {
          data: coursesRes.data || [],
          pagination: {
            total: coursesRes.count || 0,
            page,
            limit,
            pages: Math.ceil((coursesRes.count || 0) / limit)
          }
        };
        combined = combined.concat((coursesRes.data || []).map(item => ({ ...item, type: 'courses', _score: 0 })));
      }

      const mergedSorted = sortMergedResults(combined);
      const mergedPage = mergedSorted.slice(0, limit);

      return res.json({
        query: rawQuery,
        pagination: {
          total: totalCombined,
          page,
          limit,
          pages: Math.ceil(totalCombined / limit)
        },
        results: mergedPage,
        byType: resultsByType,
        fallback: true
      });
    } catch (error) {
      console.error('Unified search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

export default router;
