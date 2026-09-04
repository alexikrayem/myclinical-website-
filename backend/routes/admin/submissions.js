import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import { invalidateCachePattern } from '../../middleware/cache.js';
import { indexArticle, indexCourse, removeArticle, removeCourse } from '../../services/search/indexer.js';

const router = express.Router();
router.use(authenticateToken);

const allowedTypes = new Set(['article', 'course']);
const allowedStatuses = new Set(['draft', 'pending', 'approved', 'rejected']);

async function attachSubmitters(items) {
  const ids = [...new Set(items.map(item => item.submitted_by).filter(Boolean))];
  if (!ids.length) return items;
  const { data } = await supabase.from('users').select('id, display_name, phone_number, role, verification_status').in('id', ids);
  const users = new Map((data || []).map(user => [user.id, user]));
  return items.map(item => ({ ...item, submitter: users.get(item.submitted_by) || null }));
}

router.get('/', asyncHandler(async (req, res) => {
  const type = req.query.type || 'article';
  const status = req.query.status || 'pending';
  if (!allowedTypes.has(type) || !allowedStatuses.has(status)) throw new BadRequestError('مرشح غير صالح');
  const table = type === 'article' ? 'articles' : 'video_courses';
  const { data, error } = await supabase.from(table).select('*').eq('status', status).order('updated_at', { ascending: false });
  if (error) throw new AppError('Failed to fetch moderation queue', 500, 'SUBMISSIONS_FETCH_FAILED');
  res.json(await attachSubmitters((data || []).map(item => ({ ...item, type }))));
}));

router.get('/:type/:id', asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  if (!allowedTypes.has(type)) throw new BadRequestError('نوع المحتوى غير صالح');
  const table = type === 'article' ? 'articles' : 'video_courses';
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new AppError('Failed to fetch submission', 500, 'SUBMISSION_FETCH_FAILED');
  if (!data) throw new NotFoundError('Submission not found');
  res.json((await attachSubmitters([{ ...data, type }]))[0]);
}));

router.post('/:type/:id/approve', asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  if (!allowedTypes.has(type)) throw new BadRequestError('نوع المحتوى غير صالح');
  const table = type === 'article' ? 'articles' : 'video_courses';
  const now = new Date().toISOString();
  const { data, error } = await supabase.from(table).update({
    status: 'approved', reviewed_by: req.user.id, reviewed_at: now, published_at: now,
    rejection_reason: null, publication_date: now, updated_at: now
  }).eq('id', id).eq('status', 'pending').select('*').maybeSingle();
  if (error) throw new AppError('Failed to approve submission', 500, 'SUBMISSION_APPROVE_FAILED');
  if (!data) throw new BadRequestError('هذا المحتوى ليس قيد المراجعة');
  if (type === 'article') {
    await indexArticle(data);
    await invalidateCachePattern('cache:/api/articles*');
  } else {
    await indexCourse(data);
    await invalidateCachePattern('cache:/api/courses*');
  }
  res.json(data);
}));

router.post('/:type/:id/reject', asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const reason = String(req.body.rejection_reason || '').trim();
  if (!allowedTypes.has(type)) throw new BadRequestError('نوع المحتوى غير صالح');
  if (!reason || reason.length > 1000) throw new BadRequestError('سبب الرفض مطلوب');
  const table = type === 'article' ? 'articles' : 'video_courses';
  const { data, error } = await supabase.from(table).update({
    status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(), rejection_reason: reason, updated_at: new Date().toISOString()
  }).eq('id', id).eq('status', 'pending').select('*').maybeSingle();
  if (error) throw new AppError('Failed to reject submission', 500, 'SUBMISSION_REJECT_FAILED');
  if (!data) throw new BadRequestError('هذا المحتوى ليس قيد المراجعة');
  if (type === 'article') {
    await removeArticle(id);
    await invalidateCachePattern('cache:/api/articles*');
  } else {
    await removeCourse(id);
    await invalidateCachePattern('cache:/api/courses*');
  }
  res.json(data);
}));

export default router;
