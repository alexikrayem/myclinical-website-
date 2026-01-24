/*
  # Video Courses, Credit System, and AI Quizzes

  1. New Tables
    - `video_courses`: Stores video course details (title, description, video_url, transcript, etc.)
    - `user_credits`: Tracks user credit balances
    - `credit_transactions`: Logs all credit changes (purchases, usage, redemption)
    - `course_access`: Tracks which users have unlocked which courses
    - `license_codes`: Stores redeemable codes for credits
    - `quizzes`: Stores AI-generated quizzes for courses
    - `user_quiz_attempts`: Tracks user quiz performance

  2. Security
    - RLS enabled on all tables
    - Policies for users to read/write their own data
    - Policies for admins to manage everything
*/

-- 1. Video Courses Table
CREATE TABLE IF NOT EXISTS video_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  cover_image text NOT NULL,
  video_url text NOT NULL,
  transcript text, -- Full text transcript for AI generation
  author text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  credits_required integer NOT NULL DEFAULT 1,
  is_featured boolean DEFAULT false,
  duration integer, -- Duration in seconds
  publication_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  search_vector tsvector
);

-- Full-text search for video courses
CREATE OR REPLACE FUNCTION update_video_courses_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('arabic', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.author, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS video_courses_search_vector_trigger ON video_courses;
CREATE TRIGGER video_courses_search_vector_trigger
  BEFORE INSERT OR UPDATE ON video_courses
  FOR EACH ROW EXECUTE FUNCTION update_video_courses_search_vector();

CREATE INDEX IF NOT EXISTS video_courses_search_vector_idx ON video_courses USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS video_courses_categories_idx ON video_courses USING GIN(categories);

ALTER TABLE video_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view video courses" ON video_courses;
CREATE POLICY "Anyone can view video courses" ON video_courses FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Admins can manage video courses" ON video_courses;
CREATE POLICY "Admins can manage video courses" ON video_courses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

-- 2. User Credits Table
CREATE TABLE IF NOT EXISTS user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits" ON user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all credits" ON user_credits;
CREATE POLICY "Admins can view all credits" ON user_credits FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

-- 3. Credit Transactions Table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  transaction_type text NOT NULL, -- 'purchase', 'usage', 'redeem', 'bonus'
  amount integer NOT NULL, -- Positive for add, negative for spend
  description text,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  related_entity_type text, -- 'course_access', 'license_code'
  related_entity_id uuid,
  transaction_date timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON credit_transactions;
CREATE POLICY "Admins can view all transactions" ON credit_transactions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

-- 4. Course Access Table
CREATE TABLE IF NOT EXISTS course_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  course_id uuid REFERENCES video_courses(id) NOT NULL,
  access_date timestamptz DEFAULT now(),
  access_count integer DEFAULT 0,
  last_access_date timestamptz,
  UNIQUE(user_id, course_id)
);

ALTER TABLE course_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own access" ON course_access;
CREATE POLICY "Users can view own access" ON course_access FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all access" ON course_access;
CREATE POLICY "Admins can view all access" ON course_access FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

-- 5. License Codes Table
CREATE TABLE IF NOT EXISTS license_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credit_amount integer NOT NULL,
  is_redeemed boolean DEFAULT false,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) -- Admin who created it
);

ALTER TABLE license_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage license codes" ON license_codes;
CREATE POLICY "Admins can manage license codes" ON license_codes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);
-- Users can't list codes, but we need a way to redeem. 
-- Redemption will be handled via a secure RPC or backend endpoint that uses admin privileges or `security definer` function.

-- 6. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES video_courses(id) NOT NULL,
  questions jsonb NOT NULL, -- Array of { question, options[], correct_answer_index }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view quizzes for courses they access" ON quizzes;
CREATE POLICY "Anyone can view quizzes for courses they access" ON quizzes FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM course_access 
    WHERE course_access.course_id = quizzes.course_id 
    AND course_access.user_id = auth.uid()
  ) OR 
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage quizzes" ON quizzes;
CREATE POLICY "Admins can manage quizzes" ON quizzes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

-- 7. User Quiz Attempts Table
CREATE TABLE IF NOT EXISTS user_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  quiz_id uuid REFERENCES quizzes(id) NOT NULL,
  score integer NOT NULL, -- Percentage or raw score
  passed boolean DEFAULT false,
  attempted_at timestamptz DEFAULT now()
);

ALTER TABLE user_quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attempts" ON user_quiz_attempts;
CREATE POLICY "Users can view own attempts" ON user_quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own attempts" ON user_quiz_attempts;
CREATE POLICY "Users can insert own attempts" ON user_quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all attempts" ON user_quiz_attempts;
CREATE POLICY "Admins can view all attempts" ON user_quiz_attempts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
);

-- FUNCTIONS

-- Function to redeem a license code
CREATE OR REPLACE FUNCTION redeem_license_code(p_code text)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_license_record license_codes%ROWTYPE;
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if code exists and is valid
  SELECT * INTO v_license_record FROM license_codes WHERE code = p_code;
  
  IF v_license_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'رمز غير صحيح');
  END IF;
  
  IF v_license_record.is_redeemed THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم استخدام هذا الرمز مسبقاً');
  END IF;
  
  -- Mark as redeemed
  UPDATE license_codes 
  SET is_redeemed = true, redeemed_by = v_user_id, redeemed_at = now()
  WHERE id = v_license_record.id;
  
  -- Get or create user credits record
  INSERT INTO user_credits (user_id, balance, total_earned)
  VALUES (v_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = v_user_id;
  v_new_balance := v_current_balance + v_license_record.credit_amount;
  
  -- Update balance
  UPDATE user_credits 
  SET balance = v_new_balance, 
      total_earned = total_earned + v_license_record.credit_amount,
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (
    user_id, transaction_type, amount, description, 
    balance_before, balance_after, related_entity_type, related_entity_id
  ) VALUES (
    v_user_id, 'redeem', v_license_record.credit_amount, 'شحن رصيد عبر كود',
    v_current_balance, v_new_balance, 'license_code', v_license_record.id
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'تم شحن الرصيد بنجاح', 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
