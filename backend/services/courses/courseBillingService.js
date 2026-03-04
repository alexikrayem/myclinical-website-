export async function consumePlaybackHeartbeat({ supabase, sessionId, secondsDelta, idempotencyKey, customUserId }) {
  const payload = {
    p_session_id: sessionId,
    p_seconds: Math.max(0, Math.floor(secondsDelta || 0)),
    p_idempotency_key: idempotencyKey || null,
    p_custom_user_id: customUserId || null
  };

  const { data, error } = await supabase.rpc('consume_video_minutes_v2', payload);

  if (error) {
    throw error;
  }

  return data;
}
