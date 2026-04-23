import { AppError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

export async function consumePlaybackHeartbeat({ supabase, sessionId, secondsDelta, idempotencyKey, customUserId }) {
  const payload = {
    p_session_id: sessionId,
    p_seconds: Math.max(0, Math.floor(secondsDelta || 0)),
    p_idempotency_key: idempotencyKey || null,
    p_custom_user_id: customUserId || null
  };

  const { data, error } = await supabase.rpc('consume_video_minutes_v2', payload);

  if (error) {
    logger.error('Failed to consume playback minutes', { error, payload });
    throw new AppError('Failed to consume playback minutes', 500, 'BILLING_HEARTBEAT_FAILED');
  }

  return data;
}
