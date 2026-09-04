import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { supabaseAdmin as supabase } from '../config/supabase.js';
import { authenticateUser } from '../middleware/userAuth.js';
import { requireVerifiedDoctor } from '../middleware/requireCreator.js';
import { sanitizeContent } from '../middleware/inputSanitizer.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { validateUploadedFile } from '../middleware/fileValidation.js';
import { uploadToSupabase } from './admin/utils.js';
import { invalidateCachePattern } from '../middleware/cache.js';
import { removeArticle, removeCourse } from '../services/search/indexer.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const SOCIAL_KEYS = new Set(['instagram', 'facebook', 'x', 'tiktok', 'youtube', 'linkedin', 'website']);
const DEFAULT_AVATAR = 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2';

function slugify(value, fallback = 'creator') {
  const slug = String(value || '').toLowerCase().replace(/[^\u0621-\u064aa-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
  return slug || `${fallback}-${crypto.randomUUID().slice(0, 8)}`;
}

function validateArticleInput(body) {
  if (!String(body.title || '').trim() || String(body.title).length > 200) throw new BadRequestError('عنوان المقال مطلوب ويجب ألا يتجاوز 200 حرف');
  if (!String(body.excerpt || '').trim() || String(body.excerpt).length > 500) throw new BadRequestError('ملخص المقال مطلوب ويجب ألا يتجاوز 500 حرف');
  if (!String(body.content || '').trim()) throw new BadRequestError('محتوى المقال مطلوب');
  if (!['professional', 'public'].includes(body.audience || 'professional')) throw new BadRequestError('نوع الجمهور غير صالح');
  if (!['listed', 'unlisted'].includes(body.visibility || 'listed')) throw new BadRequestError('إعداد الظهور غير صالح');
  if ((body.visibility || 'listed') === 'unlisted' && body.audience !== 'public') throw new BadRequestError('المقالات غير المدرجة متاحة للمحتوى العام فقط');
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(String).map(tag => tag.trim()).filter(Boolean).slice(0, 15);
  if (!value) return [];
  try { return normalizeTags(JSON.parse(value)); } catch { return String(value).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 15); }
}

function normalizeSocialLinks(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const links = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!SOCIAL_KEYS.has(key) || typeof raw !== 'string' || !raw) continue;
    let url;
    try { url = new URL(raw); } catch { throw new BadRequestError('روابط التواصل يجب أن تكون عناوين HTTPS صالحة'); }
    if (url.protocol !== 'https:') throw new BadRequestError('روابط التواصل يجب أن تستخدم HTTPS');
    links[key] = url.toString();
  }
  return links;
}

async function ensureAuthor(user) {
  const { data: existing, error } = await supabase.from('authors').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw new AppError('Failed to fetch creator profile', 500, 'PROFILE_FETCH_FAILED');
  if (existing) return existing;
  const baseName = user.displayName || 'كاتب';
  const { data, error: insertError } = await supabase.from('authors').insert({
    user_id: user.id, name: baseName, slug: slugify(baseName, 'creator'), bio: 'كاتب على منصة ماي كلينيكال',
    image: DEFAULT_AVATAR, avatar_url: DEFAULT_AVATAR, specialization: 'تثقيف صحي', experience_years: 0,
    education: 'غير محدد', location: 'غير محدد', is_active: true, is_profile_public: true, social_links: {}
  }).select('*').single();
  if (insertError) throw new AppError('Failed to create creator profile', 500, 'PROFILE_CREATE_FAILED');
  return data;
}

router.use(authenticateUser);

router.get('/profile', asyncHandler(async (req, res) => {
  const author = await ensureAuthor(req.user);
  const [{ count: articles }, { count: courses }] = await Promise.all([
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('submitted_by', req.user.id),
    supabase.from('video_courses').select('id', { count: 'exact', head: true }).eq('submitted_by', req.user.id)
  ]);
  res.json({ ...author, stats: { articles: articles || 0, courses: courses || 0 } });
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const author = await ensureAuthor(req.user);
  const updates = {};
  for (const field of ['headline', 'bio', 'avatar_url', 'is_profile_public']) if (field in req.body) updates[field] = req.body[field];
  if (typeof updates.bio === 'string') updates.bio = sanitizeContent(updates.bio);
  if ('social_links' in req.body) updates.social_links = normalizeSocialLinks(req.body.social_links);
  if ('slug' in req.body) {
    const slug = String(req.body.slug || '').toLowerCase();
    if (!/^[\u0621-\u064aa-z0-9]+(?:-[\u0621-\u064aa-z0-9]+)*$/.test(slug)) throw new BadRequestError('الرابط المختصر غير صالح');
    updates.slug = slug;
  }
  const { data, error } = await supabase.from('authors').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', author.id).select('*').single();
  if (error?.code === '23505') throw new BadRequestError('الرابط المختصر مستخدم بالفعل');
  if (error) throw new AppError('Failed to update creator profile', 500, 'PROFILE_UPDATE_FAILED');
  res.json(data);
}));

router.post('/profile/avatar', uploadLimiter, upload.single('avatar'), validateUploadedFile(['jpg', 'jpeg', 'png']), asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('الصورة مطلوبة');
  const author = await ensureAuthor(req.user);
  const avatar_url = await uploadToSupabase(req.file, 'images');
  const { data, error } = await supabase.from('authors').update({ avatar_url, image: avatar_url, updated_at: new Date().toISOString() }).eq('id', author.id).select('*').single();
  if (error) throw new AppError('Failed to update avatar', 500, 'PROFILE_UPDATE_FAILED');
  res.json(data);
}));

router.get('/articles', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('articles').select('*').eq('submitted_by', req.user.id).order('updated_at', { ascending: false });
  if (error) throw new AppError('Failed to fetch submissions', 500, 'SUBMISSIONS_FETCH_FAILED');
  res.json(data || []);
}));

router.post('/articles', asyncHandler(async (req, res) => {
  validateArticleInput(req.body);
  if ((req.body.audience || 'professional') === 'professional' && !req.user.isVerified) {
    return requireVerifiedDoctor(req, res, () => { });
  }
  const author = await ensureAuthor(req.user);
  const title = String(req.body.title).trim();
  const audience = req.body.audience || 'professional';
  const visibility = req.body.visibility || 'listed';
  const payload = {
    title, excerpt: sanitizeContent(req.body.excerpt), content: sanitizeContent(req.body.content),
    cover_image: req.body.cover_image || '', author: author.name, author_id: author.id, submitted_by: req.user.id,
    tags: normalizeTags(req.body.tags), article_type: req.body.article_type === 'clinical_case' ? 'clinical_case' : 'article',
    audience, visibility, status: 'draft', slug: `${slugify(title, 'article')}-${crypto.randomUUID().slice(0, 8)}`,
    share_token: audience === 'public' && visibility === 'unlisted' ? crypto.randomUUID() : null
  };
  const { data, error } = await supabase.from('articles').insert(payload).select('*').single();
  if (error) throw new AppError('Failed to save article draft', 500, 'ARTICLE_CREATE_FAILED');
  res.status(201).json(data);
}));

router.put('/articles/:id', asyncHandler(async (req, res) => {
  const { data: current, error: fetchError } = await supabase.from('articles').select('*').eq('id', req.params.id).eq('submitted_by', req.user.id).maybeSingle();
  if (fetchError) throw new AppError('Failed to fetch article', 500, 'ARTICLE_FETCH_FAILED');
  if (!current) throw new ForbiddenError('لا يمكنك تعديل هذا المقال');
  validateArticleInput({ ...current, ...req.body });
  const audience = req.body.audience || current.audience;
  const visibility = req.body.visibility || current.visibility;
  if (audience === 'professional' && !req.user.isVerified) return requireVerifiedDoctor(req, res, () => { });
  const update = {
    title: req.body.title ?? current.title, excerpt: sanitizeContent(req.body.excerpt ?? current.excerpt), content: sanitizeContent(req.body.content ?? current.content),
    cover_image: req.body.cover_image ?? current.cover_image, tags: req.body.tags === undefined ? current.tags : normalizeTags(req.body.tags),
    article_type: req.body.article_type === 'clinical_case' ? 'clinical_case' : (req.body.article_type ? 'article' : current.article_type),
    audience, visibility, rejection_reason: null, updated_at: new Date().toISOString(),
    status: current.status === 'approved' ? 'pending' : current.status,
    share_token: audience === 'public' && visibility === 'unlisted' ? (current.share_token || crypto.randomUUID()) : null
  };
  const { data, error } = await supabase.from('articles').update(update).eq('id', current.id).eq('submitted_by', req.user.id).select('*').single();
  if (error) throw new AppError('Failed to update article', 500, 'ARTICLE_UPDATE_FAILED');
  if (current.status === 'approved') await removeArticle(current.id);
  await invalidateCachePattern('cache:/api/articles*');
  res.json(data);
}));

router.post('/articles/:id/submit', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('articles').update({ status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('submitted_by', req.user.id).in('status', ['draft', 'rejected']).select('*').maybeSingle();
  if (error) throw new AppError('Failed to submit article', 500, 'ARTICLE_SUBMIT_FAILED');
  if (!data) throw new BadRequestError('لا يمكن إرسال هذا المقال للمراجعة');
  res.json(data);
}));

router.delete('/articles/:id', asyncHandler(async (req, res) => {
  const { data: item, error } = await supabase.from('articles').select('id, status').eq('id', req.params.id).eq('submitted_by', req.user.id).maybeSingle();
  if (error) throw new AppError('Failed to fetch article', 500, 'ARTICLE_FETCH_FAILED');
  if (!item) throw new ForbiddenError('لا يمكنك حذف هذا المقال');
  if (item.status === 'approved') throw new BadRequestError('لا يمكن حذف مقال منشور؛ عدّله لإرساله للمراجعة');
  const { error: deleteError } = await supabase.from('articles').delete().eq('id', item.id).eq('submitted_by', req.user.id);
  if (deleteError) throw new AppError('Failed to delete article', 500, 'ARTICLE_DELETE_FAILED');
  res.status(204).end();
}));

router.get('/courses', requireVerifiedDoctor, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('video_courses').select('*').eq('submitted_by', req.user.id).order('updated_at', { ascending: false });
  if (error) throw new AppError('Failed to fetch course submissions', 500, 'COURSES_FETCH_FAILED');
  res.json(data || []);
}));

router.post('/courses', requireVerifiedDoctor, asyncHandler(async (req, res) => {
  if (!String(req.body.title || '').trim() || !String(req.body.description || '').trim()) throw new BadRequestError('عنوان ووصف الدورة مطلوبان');
  const author = await ensureAuthor(req.user);
  const { data, error } = await supabase.from('video_courses').insert({
    title: String(req.body.title).trim(), description: sanitizeContent(req.body.description), cover_image: req.body.cover_image || '',
    author: author.name, author_id: author.id, submitted_by: req.user.id, categories: normalizeTags(req.body.categories),
    duration: Number(req.body.duration) || 0, credits_required: Number(req.body.credits_required) || 0,
    playback_provider: req.body.playback_provider || 'youtube', playback_source: req.body.playback_source || null,
    billing_model: req.body.billing_model || 'free', minute_cost: 0, status: 'draft'
  }).select('*').single();
  if (error) throw new AppError('Failed to save course draft', 500, 'COURSE_CREATE_FAILED');
  res.status(201).json(data);
}));

router.post('/courses/:id/submit', requireVerifiedDoctor, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('video_courses').update({ status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('submitted_by', req.user.id).in('status', ['draft', 'rejected']).select('*').maybeSingle();
  if (error) throw new AppError('Failed to submit course', 500, 'COURSE_SUBMIT_FAILED');
  if (!data) throw new BadRequestError('لا يمكن إرسال هذه الدورة للمراجعة');
  res.json(data);
}));

export default router;
