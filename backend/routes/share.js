import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
const SITE_URL = (process.env.SITE_URL || 'https://tabeeb.com').replace(/\/$/, '');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

router.get('/p/:token', asyncHandler(async (req, res, next) => {
  // The production SPA host handles this marker after this route has supplied preview
  // metadata on the first request. It avoids a document -> SPA redirect loop.
  if (req.query.v === 'app') return next();
  const { data: article } = await supabaseAdmin.from('articles')
    .select('title, excerpt, content, cover_image, share_token')
    .eq('share_token', req.params.token).eq('status', 'approved').eq('audience', 'public').eq('visibility', 'unlisted').maybeSingle();
  if (!article) return res.status(404).type('text/plain').send('Article not found');
  const title = escapeHtml(article.title);
  const excerpt = escapeHtml(article.excerpt || '');
  const image = escapeHtml(article.cover_image || '');
  const url = `${SITE_URL}/p/${encodeURIComponent(article.share_token)}`;
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title} — MyClinical</title><meta name="description" content="${excerpt}"><meta name="robots" content="noindex, nofollow"><meta property="og:type" content="article"><meta property="og:title" content="${title}"><meta property="og:description" content="${excerpt}"><meta property="og:image" content="${image}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:locale" content="ar_AR"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${excerpt}"><meta name="twitter:image" content="${image}"></head><body><script>location.replace('/p/${encodeURIComponent(article.share_token)}?v=app')</script><noscript><main><h1>${title}</h1><p>${excerpt}</p>${article.content || ''}</main></noscript></body></html>`);
}));

export default router;
