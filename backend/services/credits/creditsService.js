import { AppError } from '../../utils/errors.js';
import { TRANSACTION_SELECT } from '../../utils/queryFields.js';
import logger from '../../config/logger.js';

const DEFAULT_CREDITS = {
  balance: 0,
  video_watch_minutes: 0,
  article_credits: 0,
  research_credits: 0,
  total_earned: 0,
  total_spent: 0
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireRpcData(data, context) {
  if (data) return data;

  logger.error('Credits RPC returned no data', context);
  throw new AppError('خطأ غير متوقع', 500, 'CREDITS_UNEXPECTED_NULL');
}

export async function getCreditBalance(supabase, userId) {
  const { data, error } = await supabase
    .from('user_credits')
    .select('balance, video_watch_minutes, article_credits, research_credits, total_earned, total_spent')
    .eq('custom_user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to fetch credit balance', { error, userId });
    throw new AppError('فشل في جلب الرصيد', 500, 'CREDITS_BALANCE_FAILED');
  }

  const genericCredits = data || DEFAULT_CREDITS;

  const { data: typedCredits, error: typedError } = await supabase
    .from('user_typed_credits')
    .select('credit_type_id, balance, credit_types(name, prefix)')
    .eq('user_id', userId)
    .gt('balance', 0)
    .limit(50);

  // Fix #14 — surface typed credit fetch failures in the response instead of silently swallowing them
  if (typedError) {
    logger.error('Error fetching typed credits', { error: typedError, userId });
    return {
      ...genericCredits,
      typed_credits: [],
      typed_credits_error: true
    };
  }

  const typed_credits = (typedCredits || []).map(tc => ({
    credit_type_id: tc.credit_type_id,
    name: tc.credit_types?.name || 'Unknown',
    prefix: tc.credit_types?.prefix || '',
    balance: tc.balance
  }));

  return {
    ...genericCredits,
    typed_credits
  };
}

export async function redeemLicenseCode(supabase, { code, userId, metadata }) {
  const normalizedCode = code.trim().toUpperCase();

  const { data, error } = await supabase
    .rpc('redeem_license_code_v3', {
      p_code: normalizedCode,
      p_user_id: userId,
      p_metadata: metadata
    });

  if (error) {
    logger.error('License code redemption RPC failed', { error, userId, code: normalizedCode });
    throw new AppError('فشل في استخدام الكود', 500, 'CREDITS_REDEEM_FAILED');
  }

  const rpcData = requireRpcData(data, { userId, operation: 'redeemLicenseCode' });

  if (!rpcData.success) {
    throw new AppError(rpcData.message || 'فشل استخدام الكود', 400, 'CREDITS_REDEEM_REJECTED');
  }

  return {
    success: true,
    message: rpcData.message,
    credits: {
      balance: rpcData.new_balance,
      video_minutes: rpcData.video_minutes,
      article_credits: rpcData.article_credits,
      research_credits: rpcData.research_credits,
    },
    credit_type: rpcData.credit_type,
    typed_balance: rpcData.typed_balance,
    credit_type_name: rpcData.credit_type_name
  };
}

export async function consumeVideoMinutes(supabase, { userId, minutes, courseId }) {
  const roundedMinutes = Math.ceil(Number(minutes));
  if (!Number.isFinite(roundedMinutes) || roundedMinutes < 1) {
    throw new AppError('عدد الدقائق يجب أن يكون موجباً', 400, 'INVALID_VIDEO_MINUTES');
  }

  const { data, error } = await supabase
    .rpc('consume_video_minutes', {
      p_user_id: userId,
      p_minutes: roundedMinutes,
      p_course_id: courseId
    });

  if (error) {
    logger.error('Consume video minutes RPC failed', { error, userId, courseId, minutes });
    throw new AppError('فشل في خصم الرصيد', 500, 'CREDITS_CONSUME_VIDEO_FAILED');
  }

  const rpcData = requireRpcData(data, { userId, courseId, operation: 'consumeVideoMinutes' });

  if (!rpcData.success) {
    throw new AppError(rpcData.message || 'رصيد غير كافي', 400, 'CREDITS_INSUFFICIENT');
  }

  return {
    success: true,
    remaining_minutes: rpcData.remaining_minutes,
    remaining_balance: rpcData.remaining_balance
  };
}

export async function consumeArticleCredit(supabase, { userId, articleId }) {
  const { data, error } = await supabase
    .rpc('consume_article_credit', {
      p_user_id: userId,
      p_article_id: articleId
    });

  if (error) {
    // Fix #3 — the RPC now pre-checks access before insertion, so a 23505 here
    // indicates an unexpected race condition bug rather than an idempotent re-attempt.
    // Log a warning instead of silently succeeding, so the anomaly is visible.
    if (error.code === '23505') {
      logger.warn('Unexpected unique constraint violation in consume_article_credit — possible race condition', { userId, articleId });
      return { success: true, message: 'لديك صلاحية الوصول بالفعل' };
    }
    logger.error('Consume article credit RPC failed', { error, userId, articleId });
    throw new AppError('فشل في خصم الرصيد', 500, 'CREDITS_CONSUME_ARTICLE_FAILED');
  }

  const rpcData = requireRpcData(data, { userId, articleId, operation: 'consumeArticleCredit' });

  if (!rpcData.success) {
    throw new AppError(rpcData.message || 'رصيد غير كافي', 400, 'CREDITS_INSUFFICIENT');
  }

  return {
    success: true,
    message: rpcData.message || 'تم فتح المقال بنجاح',
    remaining_credits: rpcData.remaining_credits,
    remaining_balance: rpcData.remaining_balance
  };
}

export async function consumeResearchCredit(supabase, { userId, researchId }) {
  const { data, error } = await supabase
    .rpc('consume_research_credit', {
      p_user_id: userId,
      p_research_id: researchId
    });

  if (error) {
    // Fix #3 — same as consumeArticleCredit: the RPC now pre-checks, so 23505 is anomalous
    if (error.code === '23505') {
      logger.warn('Unexpected unique constraint violation in consume_research_credit — possible race condition', { userId, researchId });
      return { success: true, message: 'لديك صلاحية الوصول بالفعل' };
    }
    logger.error('Consume research credit RPC failed', { error, userId, researchId });
    throw new AppError('فشل في خصم الرصيد للبحث', 500, 'CREDITS_CONSUME_RESEARCH_FAILED');
  }

  const rpcData = requireRpcData(data, { userId, researchId, operation: 'consumeResearchCredit' });

  if (!rpcData.success) {
    throw new AppError(rpcData.message || 'رصيد غير كافي', 400, 'CREDITS_INSUFFICIENT');
  }

  return {
    success: true,
    message: rpcData.message || 'تم فتح البحث بنجاح',
    remaining_credits: rpcData.remaining_credits,
    remaining_balance: rpcData.remaining_balance
  };
}

// ─── Fix #10 — Shared content access helper (DRY) ──────────────────────────────
/**
 * Generic content access checker — eliminates duplicated logic between
 * article and research access checks.
 *
 * @param {object} supabase          - Supabase client
 * @param {object} opts
 * @param {string} opts.contentTable - 'articles' | 'researches'
 * @param {string} opts.accessTable  - 'article_access' | 'research_access'
 * @param {string} opts.contentIdCol - column name in accessTable, e.g. 'article_id'
 * @param {string} opts.contentId    - the content UUID
 * @param {string|null} opts.userId  - the authenticated user's ID, or null
 * @param {boolean} opts.isAdmin     - whether the caller is an admin (skip DB query)
 * @param {string} opts.notFoundCode - AppError code when content not found
 * @param {string} opts.notFoundMsg  - Arabic message when content not found
 * @param {string} opts.accessCheckFailCode - AppError code on DB error
 * @param {string} opts.accessCheckFailMsg  - Arabic message on DB error
 */
async function checkContentAccess(supabase, {
  contentTable,
  accessTable,
  contentIdCol,
  contentId,
  userId,
  isAdmin,
  notFoundCode,
  notFoundMsg,
  accessCheckFailCode,
  accessCheckFailMsg
}) {
  if (typeof contentId !== 'string' || !UUID_RE.test(contentId)) {
    throw new AppError(notFoundMsg, 400, 'INVALID_CONTENT_ID');
  }

  // 1. Fetch the content's credits_required
  const { data: content, error: contentError } = await supabase
    .from(contentTable)
    .select('credits_required')
    .eq('id', contentId)
    .single();

  if (contentError) {
    if (contentError.code === 'PGRST116') {
      throw new AppError(notFoundMsg, 404, notFoundCode);
    }
    logger.error(`Check ${contentTable} access fetch failed`, { error: contentError, contentId });
    throw new AppError(accessCheckFailMsg, 500, accessCheckFailCode);
  }

  const creditsRequired = content.credits_required || 0;

  // 2. Unauthenticated user
  if (!userId) {
    return { has_access: false, requires_auth: true, credits_required: creditsRequired };
  }

  // 3. Free content
  if (creditsRequired === 0) {
    return { has_access: true, free: true, credits_required: 0 };
  }

  // 4. Fix #11 — Admin bypass uses flag passed from middleware, not an extra DB query
  if (isAdmin) {
    return { has_access: true, credits_required: creditsRequired, is_admin: true };
  }

  // 5. Check user access record
  const { data: access, error: accessError } = await supabase
    .from(accessTable)
    .select('id')
    .eq('custom_user_id', userId)
    .eq(contentIdCol, contentId)
    .single();

  if (accessError && accessError.code !== 'PGRST116') {
    logger.error(`${accessTable} access check failed`, { error: accessError, userId, contentId });
  }

  return { has_access: !!access, credits_required: creditsRequired };
}

// Fix #10 — Both functions now delegate to the shared helper
export async function checkArticleAccess(supabase, { articleId, userId, isAdmin = false }) {
  return checkContentAccess(supabase, {
    contentTable: 'articles',
    accessTable: 'article_access',
    contentIdCol: 'article_id',
    contentId: articleId,
    userId,
    isAdmin,
    notFoundCode: 'ARTICLE_NOT_FOUND',
    notFoundMsg: 'المقال غير موجود',
    accessCheckFailCode: 'CREDIT_ACCESS_CHECK_FAILED',
    accessCheckFailMsg: 'فشل التحقق من الوصول للمقال'
  });
}

export async function checkResearchAccess(supabase, { researchId, userId, isAdmin = false }) {
  return checkContentAccess(supabase, {
    contentTable: 'researches',
    accessTable: 'research_access',
    contentIdCol: 'research_id',
    contentId: researchId,
    userId,
    isAdmin,
    notFoundCode: 'RESEARCH_NOT_FOUND',
    notFoundMsg: 'البحث غير موجود',
    accessCheckFailCode: 'CREDIT_ACCESS_CHECK_FAILED',
    accessCheckFailMsg: 'فشل التحقق من الوصول للبحث'
  });
}

export async function getTransactions(supabase, { userId, page = 1, limit = 10, type }) {
  const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('credit_transactions')
    .select(`${TRANSACTION_SELECT}`, { count: 'exact' })
    .eq('custom_user_id', userId);

  if (type) {
    query = query.eq('transaction_type', type);
  }

  const { data, error, count } = await query
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) {
    logger.error('Get transactions failed', { error, userId, page: pageNum });
    throw new AppError('فشل في جلب السجل', 500, 'CREDITS_TRANSACTIONS_FAILED');
  }

  return {
    data,
    pagination: {
      total: count,
      // Fix #2 — return the parsed integer, not the raw query string
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil((count || 0) / limitNum)
    }
  };
}
