/*
  # Courses Architecture Hardening + Hybrid Playback

  - Align consumer data on custom_user_id
  - Add playback provider/billing model fields
  - Add playback sessions, progress, and heartbeat tracking
  - Add per-minute billing function with idempotency
*/

-- 1) Video courses: rename and add playback/billing fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_courses' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE video_courses RENAME COLUMN video_url TO playback_source;
  END IF;
END $$;

ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'per_minute',
  ADD COLUMN IF NOT EXISTS minute_cost integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playback_provider text NOT NULL DEFAULT 'vdocipher',
  ADD COLUMN IF NOT EXISTS preview_source text,
  ADD COLUMN IF NOT EXISTS preview_seconds integer NOT NULL DEFAULT 0;

-- Backfill playback_provider based on playback_source for existing rows
UPDATE video_courses
SET playback_provider = CASE
  WHEN playback_source ILIKE '%youtube.com%' OR playback_source ILIKE '%youtu.be%' THEN 'youtube'
  WHEN playback_source ILIKE 'http%' AND playback_source ILIKE '%.m3u8%' THEN 'hls'
  WHEN playback_source ILIKE 'http%' THEN 'mp4'
  ELSE 'vdocipher'
END
WHERE playback_source IS NOT NULL
  AND (playback_provider IS NULL OR playback_provider = 'vdocipher');

-- Constraints for new enum-like fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_billing_model_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_billing_model_check
      CHECK (billing_model IN ('free', 'per_course', 'per_minute'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_playback_provider_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_playback_provider_check
      CHECK (playback_provider IN ('vdocipher', 'hls', 'youtube', 'mp4'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_minute_cost_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_minute_cost_check
      CHECK (minute_cost >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_preview_seconds_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_preview_seconds_check
      CHECK (preview_seconds >= 0);
  END IF;
END $$;

-- Remove public access to raw video_courses (use courses_public view instead)
ALTER TABLE video_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view video courses" ON video_courses;

-- 2) Canonicalize custom_user_id on consumer tables
ALTER TABLE user_credits ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE course_access ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE credit_transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE user_quiz_attempts ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_credits_custom_user_unique'
  ) THEN
    ALTER TABLE user_credits
      ADD CONSTRAINT user_credits_custom_user_unique UNIQUE (custom_user_id);
  END IF;
END $$;

-- Require custom_user_id when data is already backfilled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_credits WHERE custom_user_id IS NULL) THEN
    ALTER TABLE user_credits ALTER COLUMN custom_user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM course_access WHERE custom_user_id IS NULL) THEN
    ALTER TABLE course_access ALTER COLUMN custom_user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM credit_transactions WHERE custom_user_id IS NULL) THEN
    ALTER TABLE credit_transactions ALTER COLUMN custom_user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_quiz_attempts WHERE custom_user_id IS NULL) THEN
    ALTER TABLE user_quiz_attempts ALTER COLUMN custom_user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'course_access_custom_user_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM course_access
      WHERE custom_user_id IS NOT NULL
      GROUP BY custom_user_id, course_id
      HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE course_access
        ADD CONSTRAINT course_access_custom_user_unique UNIQUE (custom_user_id, course_id);
    END IF;
  END IF;
END $$;

-- 3) Playback sessions
CREATE TABLE IF NOT EXISTS course_playback_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES video_courses(id) ON DELETE CASCADE NOT NULL,
  custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS course_playback_sessions_user_idx ON course_playback_sessions(custom_user_id);
CREATE INDEX IF NOT EXISTS course_playback_sessions_course_idx ON course_playback_sessions(course_id);

ALTER TABLE course_playback_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own playback sessions" ON course_playback_sessions;
CREATE POLICY "Users can view own playback sessions" ON course_playback_sessions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text);

-- 4) Course progress
CREATE TABLE IF NOT EXISTS course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES video_courses(id) ON DELETE CASCADE NOT NULL,
  custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  seconds_watched integer NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz,
  UNIQUE(course_id, custom_user_id)
);

CREATE INDEX IF NOT EXISTS course_progress_user_idx ON course_progress(custom_user_id);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own course progress" ON course_progress;
CREATE POLICY "Users can view own course progress" ON course_progress
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text);

-- 5) Heartbeat idempotency
CREATE TABLE IF NOT EXISTS course_playback_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES course_playback_sessions(id) ON DELETE CASCADE NOT NULL,
  custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  idempotency_key text NOT NULL,
  seconds_delta integer NOT NULL,
  minutes_charged integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS course_playback_heartbeats_session_idx ON course_playback_heartbeats(session_id);

ALTER TABLE course_playback_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own course heartbeats" ON course_playback_heartbeats;
CREATE POLICY "Users can view own course heartbeats" ON course_playback_heartbeats
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text);

-- 6) Public courses view (exclude sensitive fields)
CREATE OR REPLACE VIEW courses_public AS
  SELECT
    id,
    title,
    description,
    cover_image,
    publication_date,
    author,
    categories,
    is_featured,
    credits_required,
    rating,
    total_students,
    duration,
    level,
    billing_model,
    minute_cost,
    playback_provider,
    preview_source,
    preview_seconds
  FROM video_courses;

GRANT SELECT ON courses_public TO anon, authenticated;

-- 7) Per-minute billing with idempotency
CREATE OR REPLACE FUNCTION consume_video_minutes_v2(
  p_session_id uuid,
  p_seconds integer,
  p_idempotency_key text DEFAULT NULL,
  p_custom_user_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_session course_playback_sessions%ROWTYPE;
  v_course RECORD;
  v_progress course_progress%ROWTYPE;
  v_inserted integer := 0;
  v_prev_seconds integer := 0;
  v_new_seconds integer := 0;
  v_prev_billable integer := 0;
  v_new_billable integer := 0;
  v_minutes_to_charge integer := 0;
  v_charge_units integer := 0;
  v_has_progress boolean := false;
  v_current_minutes integer := 0;
  v_current_balance integer := 0;
  v_remaining_minutes integer := 0;
  v_remaining_balance integer := 0;
  v_balance_before integer := 0;
  v_balance_after integer := 0;
  v_charge_source text := 'video_minutes';
BEGIN
  IF p_seconds IS NULL OR p_seconds <= 0 THEN
    RETURN jsonb_build_object('success', true, 'minutes_charged', 0);
  END IF;

  SELECT * INTO v_session
  FROM course_playback_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Playback session not found');
  END IF;

  IF v_session.status <> 'active' OR v_session.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Playback session expired');
  END IF;

  IF p_custom_user_id IS NOT NULL THEN
    IF p_custom_user_id::text <> v_session.custom_user_id::text THEN
      RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;
  ELSIF auth.uid() IS NOT NULL AND auth.uid()::text <> v_session.custom_user_id::text THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  ELSIF auth.uid() IS NULL AND p_custom_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO course_playback_heartbeats (
      session_id,
      custom_user_id,
      idempotency_key,
      seconds_delta
    ) VALUES (
      p_session_id,
      v_session.custom_user_id,
      p_idempotency_key,
      p_seconds
    ) ON CONFLICT (session_id, idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      RETURN jsonb_build_object('success', true, 'minutes_charged', 0, 'duplicate', true);
    END IF;
  END IF;

  SELECT billing_model, minute_cost INTO v_course
  FROM video_courses
  WHERE id = v_session.course_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Course not found');
  END IF;

  IF v_course.billing_model <> 'per_minute' OR v_course.minute_cost <= 0 THEN
    RETURN jsonb_build_object('success', true, 'minutes_charged', 0);
  END IF;

  SELECT * INTO v_progress
  FROM course_progress
  WHERE course_id = v_session.course_id
    AND custom_user_id = v_session.custom_user_id
  FOR UPDATE;

  v_has_progress := FOUND;

  IF v_has_progress THEN
    v_prev_seconds := COALESCE(v_progress.seconds_watched, 0);
  ELSE
    v_prev_seconds := 0;
  END IF;

  v_new_seconds := v_prev_seconds + p_seconds;
  v_prev_billable := FLOOR(v_prev_seconds::numeric / 60);
  v_new_billable := FLOOR(v_new_seconds::numeric / 60);
  v_minutes_to_charge := GREATEST(v_new_billable - v_prev_billable, 0);
  v_charge_units := v_minutes_to_charge * v_course.minute_cost;

  IF v_charge_units <= 0 THEN
    IF v_has_progress THEN
      UPDATE course_progress
      SET seconds_watched = v_new_seconds,
          last_heartbeat_at = now()
      WHERE id = v_progress.id;
    ELSE
      INSERT INTO course_progress (course_id, custom_user_id, seconds_watched, last_heartbeat_at)
      VALUES (v_session.course_id, v_session.custom_user_id, v_new_seconds, now());
    END IF;
    RETURN jsonb_build_object('success', true, 'minutes_charged', 0);
  END IF;

  SELECT video_watch_minutes, balance INTO v_current_minutes, v_current_balance
  FROM user_credits
  WHERE custom_user_id = v_session.custom_user_id
  FOR UPDATE;

  IF v_current_minutes IS NULL THEN
    v_current_minutes := 0;
    v_current_balance := 0;
  END IF;

  IF v_current_minutes >= v_charge_units THEN
    v_remaining_minutes := v_current_minutes - v_charge_units;
    v_balance_before := v_current_minutes;
    v_balance_after := v_remaining_minutes;
    v_charge_source := 'video_minutes';
    UPDATE user_credits
    SET video_watch_minutes = v_remaining_minutes,
        updated_at = now()
    WHERE custom_user_id = v_session.custom_user_id;
  ELSIF v_current_balance >= v_charge_units THEN
    v_remaining_balance := v_current_balance - v_charge_units;
    v_balance_before := v_current_balance;
    v_balance_after := v_remaining_balance;
    v_charge_source := 'balance';
    UPDATE user_credits
    SET balance = v_remaining_balance,
        total_spent = total_spent + v_charge_units,
        updated_at = now()
    WHERE custom_user_id = v_session.custom_user_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'رصيد غير كافي');
  END IF;

  IF v_has_progress THEN
    UPDATE course_progress
    SET seconds_watched = v_new_seconds,
        last_heartbeat_at = now()
    WHERE id = v_progress.id;
  ELSE
    INSERT INTO course_progress (course_id, custom_user_id, seconds_watched, last_heartbeat_at)
    VALUES (v_session.course_id, v_session.custom_user_id, v_new_seconds, now());
  END IF;

  INSERT INTO credit_transactions (
    user_id,
    custom_user_id,
    transaction_type,
    amount,
    description,
    balance_before,
    balance_after,
    related_entity_type,
    related_entity_id,
    metadata
  ) VALUES (
    NULL,
    v_session.custom_user_id,
    'usage',
    -v_charge_units,
    'استهلاك دقائق مشاهدة',
    v_balance_before,
    v_balance_after,
    'course_playback',
    v_session.course_id,
    jsonb_build_object(
      'session_id', v_session.id,
      'minutes_charged', v_minutes_to_charge,
      'minute_cost', v_course.minute_cost,
      'charge_source', v_charge_source
    )
  );

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE course_playback_heartbeats
    SET minutes_charged = v_minutes_to_charge
    WHERE session_id = p_session_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  -- Return remaining balances
  SELECT video_watch_minutes, balance INTO v_remaining_minutes, v_remaining_balance
  FROM user_credits
  WHERE custom_user_id = v_session.custom_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'minutes_charged', v_minutes_to_charge,
    'remaining_minutes', COALESCE(v_remaining_minutes, 0),
    'remaining_balance', COALESCE(v_remaining_balance, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8) Update RLS policies for custom_user_id
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

ALTER TABLE course_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own access" ON course_access;
CREATE POLICY "Users can view own access" ON course_access
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

ALTER TABLE user_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own attempts" ON user_quiz_attempts;
CREATE POLICY "Users can view own attempts" ON user_quiz_attempts
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));
