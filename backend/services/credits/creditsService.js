import { AppError } from '../../utils/errors.js';

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
    throw new AppError('فشل في جلب الرصيد', 500, 'CREDITS_BALANCE_FAILED');
  }

  const genericCredits = data || DEFAULT_CREDITS;

  const { data: typedCredits, error: typedError } = await supabase
    .from('user_typed_credits')
    .select('credit_type_id, balance, credit_types(name, prefix)')
    .eq('user_id', userId)
    .gt('balance', 0);

  if (typedError) {
    console.error('Error fetching typed credits:', typedError);
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
    // Fall back to v2 if v3 is not yet deployed
    if (error.code === '42883') {
      const { data: v2Data, error: v2Error } = await supabase
        .rpc('redeem_license_code_v2', {
          p_code: normalizedCode,
          p_user_id: userId
        });

      if (v2Error) {
        // Fall back to the old function only when v2 is missing
        if (v2Error.code === '42883') {
          const { data: legacyData, error: legacyError } = await supabase
            .rpc('redeem_license_code', { p_code: normalizedCode });

          if (legacyError) {
            throw new AppError('فشل في استخدام الكود', 500, 'CREDITS_REDEEM_FAILED');
          }
          if (!legacyData.success) {
            return { status: 400, body: { error: legacyData.message } };
          }
          return { status: 200, body: legacyData };
        }
        throw new AppError('فشل في استخدام الكود', 500, 'CREDITS_REDEEM_FAILED');
      }

      if (!v2Data.success) {
        return { status: 400, body: { error: v2Data.message } };
      }

      return {
        status: 200,
        body: {
          success: true,
          message: v2Data.message,
          credits: {
            balance: v2Data.new_balance,
            video_minutes: v2Data.video_minutes,
            article_credits: v2Data.article_credits
          },
          credit_type: v2Data.credit_type
        }
      };
    }
    throw new AppError('فشل في استخدام الكود', 500, 'CREDITS_REDEEM_FAILED');
  }

  if (!data.success) {
    return { status: 400, body: { error: data.message } };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: data.message,
      credits: {
        balance: data.new_balance,
        video_minutes: data.video_minutes,
        article_credits: data.article_credits
      },
      credit_type: data.credit_type
    }
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
    throw new AppError('فشل في خصم الرصيد', 500, 'CREDITS_CONSUME_VIDEO_FAILED');
  }

  if (!data.success) {
    return { status: 400, body: { error: data.message } };
  }

  return {
    status: 200,
    body: {
      success: true,
      remaining_minutes: data.remaining_minutes,
      remaining_balance: data.remaining_balance
    }
  };
}

export async function consumeArticleCredit(supabase, { userId, articleId }) {
  const { data, error } = await supabase
    .rpc('consume_article_credit', {
      p_user_id: userId,
      p_article_id: articleId
    });

  if (error) {
    throw new AppError('فشل في خصم الرصيد', 500, 'CREDITS_CONSUME_ARTICLE_FAILED');
  }

  if (!data.success) {
    return { status: 400, body: { error: data.message } };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'تم فتح المقال بنجاح',
      remaining_credits: data.remaining_credits,
      remaining_balance: data.remaining_balance
    }
  };
}

export async function checkArticleAccess(supabase, { articleId, userId }) {
  const { data: article } = await supabase
    .from('articles')
    .select('credits_required')
    .eq('id', articleId)
    .single();

  if (!article) {
    return { status: 404, body: { error: 'المقال غير موجود' } };
  }

  if (!userId) {
    return {
      status: 200,
      body: {
        has_access: false,
        requires_auth: true,
        credits_required: article.credits_required
      }
    };
  }

  if (article.credits_required === 0) {
    return { status: 200, body: { has_access: true, free: true, credits_required: 0 } };
  }

  const { data: access } = await supabase
    .from('article_access')
    .select('id')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .single();

  return {
    status: 200,
    body: {
      has_access: !!access,
      credits_required: article.credits_required
    }
  };
}

export async function consumeResearchCredit(supabase, { userId, researchId }) {
  const { data, error } = await supabase
    .rpc('consume_research_credit', {
      p_user_id: userId,
      p_research_id: researchId
    });

  if (error) {
    throw new AppError('فشل في خصم الرصيد للبحث', 500, 'CREDITS_CONSUME_RESEARCH_FAILED');
  }

  if (!data.success) {
    return { status: 400, body: { error: data.message } };
  }

  return { status: 200, body: { success: true, message: 'تم فتح البحث بنجاح' } };
}

export async function checkResearchAccess(supabase, { researchId, userId }) {
  const { data: research } = await supabase
    .from('researches')
    .select('credits_required')
    .eq('id', researchId)
    .single();

  if (!research) {
    return { status: 404, body: { error: 'البحث غير موجود' } };
  }

  const creditsRequired = research.credits_required || 0;

  if (!userId) {
    return {
      status: 200,
      body: {
        has_access: false,
        requires_auth: true,
        credits_required: creditsRequired
      }
    };
  }

  if (creditsRequired === 0) {
    return { status: 200, body: { has_access: true, free: true, credits_required: 0 } };
  }

  const { data: adminCheck } = await supabase
    .from('admins')
    .select('id')
    .eq('id', userId)
    .single();

  if (adminCheck) {
    return { status: 200, body: { has_access: true, credits_required: creditsRequired } };
  }

  const { data: access } = await supabase
    .from('research_access')
    .select('id')
    .eq('user_id', userId)
    .eq('research_id', researchId)
    .single();

  return {
    status: 200,
    body: {
      has_access: !!access,
      credits_required: creditsRequired
    }
  };
}

export async function getTransactions(supabase, { userId, page = 1, limit = 10, type }) {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('credit_transactions')
    .select('*', { count: 'exact' })
    .eq('custom_user_id', userId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (type) {
    query = query.eq('transaction_type', type);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new AppError('فشل في جلب السجل', 500, 'CREDITS_TRANSACTIONS_FAILED');
  }

  return {
    data,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil((count || 0) / limitNum)
    }
  };
}
