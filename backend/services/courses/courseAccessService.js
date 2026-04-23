import { getPublicCourseById } from './courseCatalogService.js';
import { AppError, NotFoundError } from '../../utils/errors.js';

async function getApplicableTypedCredits(supabaseAdmin, userId, courseId) {
  const { data: typedData, error: typedError } = await supabaseAdmin
    .from('user_typed_credits')
    .select('credit_type_id, balance, credit_types!inner(name, prefix)')
    .eq('user_id', userId)
    .gt('balance', 0);

  if (typedError) {
    throw new AppError('Failed to fetch typed credits', 500, 'COURSE_TYPED_CREDITS_FAILED');
  }

  const applicable = [];
  if (!typedData || typedData.length === 0) return applicable;

  const creditTypeIds = typedData.map(tc => tc.credit_type_id);
  
  const { data: linkedTypes, error: linkError } = await supabaseAdmin
    .from('credit_type_courses')
    .select('credit_type_id')
    .in('credit_type_id', creditTypeIds)
    .eq('course_id', courseId);

  if (linkError) {
    throw new AppError('Failed to fetch credit type courses', 500, 'COURSE_TYPED_CREDITS_FAILED');
  }

  const linkedSet = new Set((linkedTypes || []).map(l => l.credit_type_id));

  for (const tc of typedData) {
    if (linkedSet.has(tc.credit_type_id)) {
      applicable.push({
        credit_type_id: tc.credit_type_id,
        name: tc.credit_types?.name,
        prefix: tc.credit_types?.prefix,
        balance: tc.balance
      });
    }
  }

  return applicable;
}

export async function getCourseAccessDetails({ supabasePublic, supabaseAdmin, courseId, user }) {
  const course = await getPublicCourseById(supabasePublic, courseId);
  if (!course) {
    throw new NotFoundError('Course not found');
  }

  let hasAccess = course.billing_model !== 'per_course';
  const requiresAuth = !user;

  if (course.billing_model === 'per_course') {
    hasAccess = false;
    if (user) {
      const { data: access, error } = await supabaseAdmin
        .from('course_access')
        .select('id')
        .eq('custom_user_id', user.id)
        .eq('course_id', courseId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new AppError('Failed to fetch course access', 500, 'COURSE_ACCESS_FAILED');
      }

      if (access) {
        hasAccess = true;
      }
    }
  } else if (!user) {
    hasAccess = false;
  }

  let applicable_typed_credits = [];
  if (user && !hasAccess) {
    applicable_typed_credits = await getApplicableTypedCredits(supabaseAdmin, user.id, courseId);
  }

  return {
    course,
    has_access: hasAccess,
    requires_auth: requiresAuth,
    applicable_typed_credits
  };
}
