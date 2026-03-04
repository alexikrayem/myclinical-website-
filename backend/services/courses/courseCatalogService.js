import { sanitizeSearchInput } from '../../utils/searchUtils.js';
import { meiliSearch, orderByIdList } from '../search/searchService.js';

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

      if (fetchError) throw fetchError;

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

    const sanitizedSearch = sanitizeSearchInput(search);
    if (sanitizedSearch) {
      query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,author.ilike.%${sanitizedSearch}%`);
    }
  }

  const { data, error, count } = await query
    .order('publication_date', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) throw error;

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
    throw error;
  }
  return data;
}
