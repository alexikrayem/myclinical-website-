/*
  # Verify Attention Challenge RPC
  
  Atomically verifies an attention challenge to prevent race conditions 
  when multiple verify requests are made simultaneously for the same challenge.
*/

CREATE OR REPLACE FUNCTION verify_attention_challenge(
  p_challenge_id UUID,
  p_session_id UUID,
  p_user_id UUID,
  p_passed BOOLEAN,
  p_max_failures INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
  v_session RECORD;
  v_new_status TEXT;
  v_new_failures INTEGER;
  v_terminated BOOLEAN := FALSE;
  v_attention_score INTEGER := 100;
  v_passed_count INTEGER := 0;
  v_total_responded INTEGER := 0;
BEGIN
  -- 1. Fetch challenge and row lock it
  SELECT * INTO v_challenge
  FROM attention_checks
  WHERE id = p_challenge_id
  FOR UPDATE;

  IF v_challenge IS NULL THEN
    RETURN jsonb_build_object('error', 'Challenge not found', 'status', 404);
  END IF;

  IF v_challenge.custom_user_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 403);
  END IF;

  IF v_challenge.session_id != p_session_id THEN
    RETURN jsonb_build_object('error', 'Session mismatch', 'status', 400);
  END IF;

  IF v_challenge.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Challenge already responded to', 'status', 400);
  END IF;

  -- 2. Fetch session and row lock it
  SELECT * INTO v_session
  FROM course_playback_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('error', 'Session not found', 'status', 404);
  END IF;

  -- 3. Determine outcome
  v_new_status := CASE WHEN p_passed THEN 'passed' ELSE 'failed' END;
  v_new_failures := v_session.attention_failures;

  IF NOT p_passed THEN
    v_new_failures := v_new_failures + 1;
    IF v_new_failures >= p_max_failures THEN
      v_terminated := TRUE;
    END IF;
  END IF;

  -- 4. Update challenge
  UPDATE attention_checks
  SET status = v_new_status, responded_at = NOW()
  WHERE id = p_challenge_id;

  -- 5. Terminate session or update failures
  IF v_terminated THEN
    UPDATE course_playback_sessions
    SET status = 'terminated', attention_failures = v_new_failures
    WHERE id = p_session_id;

    -- Expire any remaining pending checks
    UPDATE attention_checks
    SET status = 'expired'
    WHERE session_id = p_session_id AND status = 'pending';
  ELSE
    UPDATE course_playback_sessions
    SET attention_failures = v_new_failures
    WHERE id = p_session_id;
  END IF;

  -- 6. Recalculate attention score
  SELECT 
    COUNT(*), 
    COUNT(*) FILTER (WHERE status = 'passed')
  INTO v_total_responded, v_passed_count
  FROM attention_checks
  WHERE session_id = p_session_id AND status != 'pending';

  IF v_total_responded > 0 THEN
    v_attention_score := ROUND((v_passed_count::NUMERIC / v_total_responded::NUMERIC) * 100);
  END IF;

  -- 7. Update session attention score
  UPDATE course_playback_sessions
  SET attention_score = v_attention_score
  WHERE id = p_session_id;

  -- 8. Return result
  RETURN jsonb_build_object(
    'passed', p_passed,
    'session_terminated', v_terminated,
    'attention_score', v_attention_score,
    'failures', v_new_failures,
    'max_failures', p_max_failures
  );
END;
$$;
