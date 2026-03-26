import { AppError } from '../../utils/errors.js';

export async function purchaseCourseAccess(supabase, { courseId, userId, idempotencyKey }) {
  const { data, error } = await supabase.rpc('purchase_course_access', {
    p_course_id: courseId,
    p_user_id: userId,
    p_idempotency_key: idempotencyKey || null
  });

  if (error) {
    console.error('RPC Error purchasing course:', error);
    throw new AppError('Failed to purchase course', 500, 'COURSE_PURCHASE_FAILED');
  }

  if (!data.success) {
    return { status: 400, body: data };
  }

  return { status: 200, body: data };
}
