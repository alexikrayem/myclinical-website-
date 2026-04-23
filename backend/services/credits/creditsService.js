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
    .gt('balance', 0);

  if (typedError) {
    logger.error('Error fetching typed credits', { error: typedError, userId });
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

  if (!data.success) {
    throw new AppError(data.message || 'فشل استخدام الكود', 400, 'CREDITS_REDEEM_REJECTED');
  }

  return {
    success: true,
    message: data.message,
    credits: {
      balance: data.new_balance,
      video_minutes: data.video_minutes,
      article_credits: data.article_credits,
      research_credits: data.research_credits,
    },
    credit_type: data.credit_type,
    typed_balance: data.typed_balance,
    credit_type_name: data.credit_type_name
  };
}

export async function consumeVideoMinutes(supabase, { userId, minutes, courseId }) {
  const { data, error } = await supabase
    .rpc('consume_video_minutes', {
      p_user_id: userId,
      p_minutes: Math.ceil(minutes),
      p_course_id: courseId
    });

  if (error) {
    logger.error('Consume video minutes RPC failed', { error, userId, courseId, minutes });
    throw new AppError('فشل في خصم الرصيد', 500, 'CREDITS_CONSUME_VIDEO_FAILED');
  }

  if (!data.success) {
    throw new AppError(data.message || 'رصيد غير كافي', 400, 'CREDITS_INSUFFICIENT');
  }

  return {
    success: true,
    remaining_minutes: data.remaining_minutes,
    remaining_balance: data.remaining_balance
  };
}

export async function consumeArticleCredit(supabase, { userId, articleId }) {
  const { data, error } = await supabase
    .rpc('consume_article_credit', {
      p_user_id: userId,
      p_article_id: articleId
    });

  if (error) {
    // Unique constraint violation (23505) indicates they already have access
    if (error.code === '23505') {
       return { success: true, message: 'لديك صلاحية الوصول بالفعل' };
    }
    logger.error('Consume article credit RPC failed', { error, userId, articleId });
    throw new AppError('فشل في خصم الرصيد', 500, 'CREDITS_CONSUME_ARTICLE_FAILED');
  }

  if (!data.success) {
    throw new AppError(data.message || 'رصيد غير كافي', 400, 'CREDITS_INSUFFICIENT');
  }

  return {
    success: true,
    message: data.message || 'تم فتح المقال بنجاح',
    remaining_credits: data.remaining_credits,
    remaining_balance: data.remaining_balance
  };
}

export async function checkArticleAccess(supabase, { articleId, userId }) {
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select('credits_required')
    .eq('id', articleId)
    .single();

  if (articleError) {
    if (articleError.code === 'PGRST116') {
      throw new AppError('المقال غير موجود', 404, 'ARTICLE_NOT_FOUND');
    }
    logger.error('Check article access fetch failed', { error: articleError, articleId });
    throw new AppError('فشل التحقق من الوصول للمقال', 500, 'CREDIT_ACCESS_CHECK_FAILED');
  }

  const creditsRequired = article.credits_required || 0;

  if (!userId) {
    return {
      has_access: false,
      requires_auth: true,
      credits_required: creditsRequired
    };
  }

  if (creditsRequired === 0) {
    return { has_access: true, free: true, credits_required: 0 };
  }

  // Admin Bypass
  const { data: adminCheck } = await supabase
    .from('admins')
    .select('id')
    .eq('id', userId)
    .single();

  if (adminCheck) {
    return { has_access: true, credits_required: creditsRequired, is_admin: true };
  }

  const { data: access, error: accessError } = await supabase
    .from('article_access')
    .select('id')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .single();

  if (accessError && accessError.code !== 'PGRST116') {
    logger.error('Article access check failed', { error: accessError, userId, articleId });
  }

  return {
    has_access: !!access,
    credits_required: creditsRequired
  };
}

export async function consumeResearchCredit(supabase, { userId, researchId }) {
  const { data, error } = await supabase
    .rpc('consume_research_credit', {
      p_user_id: userId,
      p_research_id: researchId
    });

  if (error) {
    if (error.code === '23505') {
       return { success: true, message: 'لديك صلاحية الوصول بالفعل' };
    }
    logger.error('Consume research credit RPC failed', { error, userId, researchId });
    throw new AppError('فشل في خصم الرصيد للبحث', 500, 'CREDITS_CONSUME_RESEARCH_FAILED');
  }

  if (!data.success) {
     throw new AppError(data.message || 'رصيد غير كافي', 400, 'CREDITS_INSUFFICIENT');
  }

  return { 
    success: true, 
    message: data.message || 'تم فتح البحث بنجاح',
    remaining_credits: data.remaining_credits,
    remaining_balance: data.remaining_balance
  };
}

export async function checkResearchAccess(supabase, { researchId, userId }) {
  const { data: research, error: researchError } = await supabase
    .from('researches')
    .select('credits_required')
    .eq('id', researchId)
    .single();

  if (researchError) {
    if (researchError.code === 'PGRST116') {
       throw new AppError('البحث غير موجود', 404, 'RESEARCH_NOT_FOUND');
    }
    logger.error('Check research access fetch failed', { error: researchError, researchId });
    throw new AppError('فشل التحقق من الوصول للبحث', 500, 'CREDIT_ACCESS_CHECK_FAILED');
  }

  const creditsRequired = research.credits_required || 0;

  if (!userId) {
    return {
      has_access: false,
      requires_auth: true,
      credits_required: creditsRequired
    };
  }

  if (creditsRequired === 0) {
    return { has_access: true, free: true, credits_required: 0 };
  }

  // Admin Bypass
  const { data: adminCheck } = await supabase
    .from('admins')
    .select('id')
    .eq('id', userId)
    .single();

  if (adminCheck) {
    return { has_access: true, credits_required: creditsRequired, is_admin: true };
  }

  const { data: access, error: accessError } = await supabase
    .from('research_access')
    .select('id')
    .eq('user_id', userId)
    .eq('research_id', researchId)
    .single();

  if (accessError && accessError.code !== 'PGRST116') {
     logger.error('Research access check failed', { error: accessError, userId, researchId });
  }

  return {
    has_access: !!access,
    credits_required: creditsRequired
  };
}

export async function getTransactions(supabase, { userId, page = 1, limit = 10, type }) {
  const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('credit_transactions')
    .select(`${TRANSACTION_SELECT}`, { count: 'exact' })
    .eq('custom_user_id', userId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (type) {
    query = query.eq('transaction_type', type);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error('Get transactions failed', { error, userId, page });
    throw new AppError('فشل في جلب السجل', 500, 'CREDITS_TRANSACTIONS_FAILED');
  }

  return {
    data,
    pagination: {
      total: count,
      page: page,
      limit: limitNum,
      pages: Math.ceil((count || 0) / limitNum)
    }
  };
}
