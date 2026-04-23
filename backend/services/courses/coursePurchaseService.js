import { AppError, BadRequestError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

export async function purchaseCourseAccess(supabase, { courseId, userId, idempotencyKey }) {
  const { data, error } = await supabase.rpc('purchase_course_access', {
    p_course_id: courseId,
    p_user_id: userId,
    p_idempotency_key: idempotencyKey || null
  });

  if (error) {
    logger.error('RPC Error purchasing course', { error, courseId, userId, idempotencyKey });
    throw new AppError('Failed to purchase course', 500, 'COURSE_PURCHASE_FAILED');
  }

  if (!data.success) {
    throw new BadRequestError(data.error || data.message || 'Failed to purchase course');
  }

  return data;
}
