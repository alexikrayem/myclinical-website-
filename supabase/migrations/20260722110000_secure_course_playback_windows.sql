-- Short-lived, prepaid playback windows for per-minute courses.
-- `course_progress` remains a cross-session learning-progress record; billing
-- is deliberately session-scoped so reopening a course cannot replay already
-- paid minute boundaries for free.

ALTER TABLE course_playback_sessions
  ADD COLUMN IF NOT EXISTS seconds_watched integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prepaid_minutes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS course_playback_sessions_expiry_idx
  ON course_playback_sessions (expires_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION reserve_video_playback_minutes(
  p_session_id uuid,
  p_minutes integer DEFAULT 1,
  p_custom_user_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_session course_playback_sessions%ROWTYPE;
  v_course RECORD;
  v_minutes integer := GREATEST(COALESCE(p_minutes, 0), 0);
  v_cost integer := 0;
  v_watch_minutes integer := 0;
  v_balance integer := 0;
  v_remaining_minutes integer := 0;
  v_remaining_balance integer := 0;
  v_source text := 'video_minutes';
BEGIN
  IF v_minutes < 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid reservation');
  END IF;

  SELECT * INTO v_session FROM course_playback_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.status <> 'active' OR v_session.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Playback session expired');
  END IF;
  IF p_custom_user_id IS NOT NULL AND p_custom_user_id::text <> v_session.custom_user_id::text THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT billing_model, minute_cost INTO v_course FROM video_courses WHERE id = v_session.course_id;
  IF NOT FOUND OR v_course.billing_model <> 'per_minute' OR COALESCE(v_course.minute_cost, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Course is not billable by minute');
  END IF;
  v_cost := v_minutes * v_course.minute_cost;

  SELECT COALESCE(video_watch_minutes, 0), COALESCE(balance, 0)
    INTO v_watch_minutes, v_balance
  FROM user_credits WHERE custom_user_id = v_session.custom_user_id FOR UPDATE;

  IF v_watch_minutes >= v_cost THEN
    v_remaining_minutes := v_watch_minutes - v_cost;
    v_remaining_balance := v_balance;
    UPDATE user_credits SET video_watch_minutes = v_remaining_minutes, updated_at = now()
      WHERE custom_user_id = v_session.custom_user_id;
  ELSIF v_balance >= v_cost THEN
    v_remaining_minutes := v_watch_minutes;
    v_remaining_balance := v_balance - v_cost;
    v_source := 'balance';
    UPDATE user_credits
      SET balance = v_remaining_balance, total_spent = total_spent + v_cost, updated_at = now()
      WHERE custom_user_id = v_session.custom_user_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'رصيد غير كافي');
  END IF;

  UPDATE course_playback_sessions
    SET prepaid_minutes = prepaid_minutes + v_minutes
    WHERE id = p_session_id;

  INSERT INTO credit_transactions (
    user_id, custom_user_id, transaction_type, amount, description,
    balance_before, balance_after, related_entity_type, related_entity_id, metadata
  ) VALUES (
    NULL, v_session.custom_user_id, 'usage', -v_cost, 'حجز دقائق مشاهدة',
    CASE WHEN v_source = 'video_minutes' THEN v_watch_minutes ELSE v_balance END,
    CASE WHEN v_source = 'video_minutes' THEN v_remaining_minutes ELSE v_remaining_balance END,
    'course_playback', v_session.course_id,
    jsonb_build_object('session_id', v_session.id, 'minutes_reserved', v_minutes,
      'minute_cost', v_course.minute_cost, 'charge_source', v_source)
  );

  RETURN jsonb_build_object('success', true, 'minutes_reserved', v_minutes,
    'remaining_minutes', v_remaining_minutes, 'remaining_balance', v_remaining_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION consume_video_minutes_v2(
  p_session_id uuid,
  p_seconds integer,
  p_idempotency_key text DEFAULT NULL,
  p_custom_user_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_session course_playback_sessions%ROWTYPE;
  v_inserted integer := 0;
  v_new_seconds integer := 0;
  v_required_minutes integer := 0;
  v_extra_minutes integer := 0;
  v_reservation jsonb;
BEGIN
  IF p_seconds IS NULL OR p_seconds <= 0 THEN
    RETURN jsonb_build_object('success', true, 'minutes_charged', 0);
  END IF;

  SELECT * INTO v_session FROM course_playback_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.status <> 'active' OR v_session.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Playback session expired');
  END IF;
  IF p_custom_user_id IS NOT NULL AND p_custom_user_id::text <> v_session.custom_user_id::text THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO course_playback_heartbeats (session_id, custom_user_id, idempotency_key, seconds_delta)
    VALUES (p_session_id, v_session.custom_user_id, p_idempotency_key, p_seconds)
    ON CONFLICT (session_id, idempotency_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      RETURN jsonb_build_object('success', true, 'minutes_charged', 0, 'duplicate', true);
    END IF;
  END IF;

  v_new_seconds := v_session.seconds_watched + p_seconds;
  v_required_minutes := CEIL(v_new_seconds::numeric / 60.0);
  v_extra_minutes := GREATEST(v_required_minutes - v_session.prepaid_minutes, 0);
  IF v_extra_minutes > 0 THEN
    SELECT reserve_video_playback_minutes(p_session_id, v_extra_minutes, p_custom_user_id) INTO v_reservation;
    IF NOT COALESCE((v_reservation ->> 'success')::boolean, false) THEN
      RETURN v_reservation || jsonb_build_object('minutes_charged', 0);
    END IF;
  END IF;

  UPDATE course_playback_sessions SET seconds_watched = v_new_seconds WHERE id = p_session_id;
  INSERT INTO course_progress (course_id, custom_user_id, seconds_watched, last_heartbeat_at)
  VALUES (v_session.course_id, v_session.custom_user_id, p_seconds, now())
  ON CONFLICT (course_id, custom_user_id) DO UPDATE
    SET seconds_watched = course_progress.seconds_watched + EXCLUDED.seconds_watched,
        last_heartbeat_at = now();

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE course_playback_heartbeats SET minutes_charged = v_extra_minutes
      WHERE session_id = p_session_id AND idempotency_key = p_idempotency_key;
  END IF;

  RETURN jsonb_build_object('success', true, 'minutes_charged', v_extra_minutes,
    'remaining_minutes', COALESCE(v_reservation ->> 'remaining_minutes', '0')::integer,
    'remaining_balance', COALESCE(v_reservation ->> 'remaining_balance', '0')::integer);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- A lightweight scheduled invocation may run this statement (Supabase Cron,
-- pg_cron, or the deployment scheduler) to make session state explicit:
-- UPDATE course_playback_sessions SET status = 'expired'
-- WHERE status = 'active' AND expires_at < now();
