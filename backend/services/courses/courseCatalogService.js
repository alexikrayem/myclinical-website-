import { sanitizeSearchInput, buildFtsQuery } from '../../utils/searchUtils.js';
import { meiliSearch, orderByIdList } from '../search/searchService.js';
import { AppError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

export const COURSE_PUBLIC_SELECT = [
  'id',
  'title',
  'description',
  'cover_image',
  'publication_date',
  'author',
  'categories',
  'is_featured',
  'credits_required',
  'rating',
  'total_students',
  'duration',
  'level',
  'billing_model',
  'minute_cost',
  'playback_provider',
  'preview_source',
  'preview_seconds'
].join(', ');

export async function listPublicCourses(supabase, params) {
  const { category, search, limit = 12, page = 1, featured } = params;
  const limitNum = parseInt(limit);
  const pageNum = parseInt(page);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('courses_public')
    .select(COURSE_PUBLIC_SELECT, { count: 'exact' });

  if (category) {
    query = query.contains('categories', [category]);
  }

  if (featured === 'true') {
    query = query.eq('is_featured', true);
  }

  if (search) {
    const meiliResult = await meiliSearch('courses', search, {
      page: pageNum,
      limit: limitNum,
      filters: {
        ...(category ? { categories: category } : {}),
        ...(featured === 'true' ? { is_featured: true } : {})
      }
    });

    if (meiliResult) {
      const ids = meiliResult.hits.map(hit => hit.id);
      const total = meiliResult.estimatedTotalHits || 0;

      if (!ids.length) {
        return {
          data: [],
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum)
          }
        };
      }

      const { data: rows, error: fetchError } = await supabase
        .from('courses_public')
        .select(COURSE_PUBLIC_SELECT)
        .in('id', ids);

      if (fetchError) {
        logger.error('Error fetching courses list from DB', { error: fetchError });
        throw new AppError('Failed to fetch courses from DB', 500, 'CATALOG_FETCH_FAILED');
      }

      const ordered = orderByIdList(rows, ids);
      return {
        data: ordered,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      };
    }

    const ftsString = buildFtsQuery(search);
    if (ftsString) {
      query = query.or(`title.fts."${ftsString}",description.fts."${ftsString}",author.fts."${ftsString}"`);
    }
  }

  const { data, error, count } = await query
    .order('publication_date', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) {
    logger.error('Error querying courses catalog', { error });
    throw new AppError('Failed to traverse course catalog', 500, 'CATALOG_FETCH_FAILED');
  }

  return {
    data,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(count / limitNum)
    }
  };
}

export async function getPublicCourseById(supabase, id) {
  const { data, error } = await supabase
    .from('courses_public')
    .select(COURSE_PUBLIC_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Error fetching specific public course', { error, id });
    throw new AppError('Failed to fetch public course', 500, 'CATALOG_FETCH_SINGLE_FAILED');
  }
  return data;
}

/**
 * Returns a deduplicated, sorted list of all category strings across all
 * published courses. The database unnests/distincts categories, avoiding a
 * full catalog transfer solely to build this small list.
 */
export async function getPublicCourseCategories(supabase) {
  const { data, error } = await supabase.rpc('get_public_course_categories');

  if (error) {
    logger.error('Error fetching course categories', { error });
    throw new AppError('Failed to fetch course categories', 500, 'CATALOG_CATEGORIES_FAILED');
  }

  return (data ?? [])
    .map(({ category }) => category)
    .sort((a, b) => a.localeCompare(b, 'ar'));
}
