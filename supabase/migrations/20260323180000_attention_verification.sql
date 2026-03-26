/*
  # Attention Verification System
  
  Adds attention-check infrastructure to ensure users genuinely watch course
  videos before they can obtain printed licenses/certificates.

  1. New columns on video_courses:
     - attention_required (per-course toggle)
     - attention_check_interval_min / max (seconds between checks)
     - attention_max_failures (strikes before session termination)

  2. New table: attention_checks
     - Stores each scheduled challenge, its payload, and result

  3. New columns on course_playback_sessions:
     - attention_score (0-100%)
     - attention_failures (running failure count)
*/

-- 1) Add attention columns to video_courses
ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS attention_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_check_interval_min integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS attention_check_interval_max integer NOT NULL DEFAULT 420,
  ADD COLUMN IF NOT EXISTS attention_max_failures integer NOT NULL DEFAULT 3;

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_attn_interval_min_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_attn_interval_min_check
      CHECK (attention_check_interval_min >= 60);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_attn_interval_max_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_attn_interval_max_check
      CHECK (attention_check_interval_max >= attention_check_interval_min);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'video_courses_attn_max_failures_check'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_attn_max_failures_check
      CHECK (attention_max_failures >= 1);
  END IF;
END $$;

-- 2) Add tracking columns to playback sessions
ALTER TABLE course_playback_sessions
  ADD COLUMN IF NOT EXISTS attention_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attention_failures integer NOT NULL DEFAULT 0;

-- 3) Create attention_checks table
CREATE TABLE IF NOT EXISTS attention_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES course_playback_sessions(id) ON DELETE CASCADE NOT NULL,
  custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  challenge_type text NOT NULL DEFAULT 'color',
  challenge_data jsonb NOT NULL DEFAULT '{}',
  challenge_token text NOT NULL,
  trigger_at_seconds integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Constraints on attention_checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attention_checks_type_check'
  ) THEN
    ALTER TABLE attention_checks
      ADD CONSTRAINT attention_checks_type_check
      CHECK (challenge_type IN ('confirm', 'math', 'color'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attention_checks_status_check'
  ) THEN
    ALTER TABLE attention_checks
      ADD CONSTRAINT attention_checks_status_check
      CHECK (status IN ('pending', 'passed', 'failed', 'expired'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS attention_checks_session_idx ON attention_checks(session_id);
CREATE INDEX IF NOT EXISTS attention_checks_user_idx ON attention_checks(custom_user_id);
CREATE INDEX IF NOT EXISTS attention_checks_pending_idx ON attention_checks(session_id, status)
  WHERE status = 'pending';

-- 4) RLS
ALTER TABLE attention_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attention checks" ON attention_checks;
CREATE POLICY "Users can view own attention checks" ON attention_checks
  FOR SELECT TO authenticated
  USING (auth.uid()::text = custom_user_id::text);

DROP POLICY IF EXISTS "Admins can manage attention checks" ON attention_checks;
CREATE POLICY "Admins can manage attention checks" ON attention_checks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- 5) Update public courses view to include attention_required flag
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
    preview_seconds,
    attention_required
  FROM video_courses;

GRANT SELECT ON courses_public TO anon, authenticated;
