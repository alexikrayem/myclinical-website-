/*
  # Phone Authentication & Enhanced Credit System
  
  This migration creates:
  1. Users table for phone + password authentication
  2. Enhanced credit system with video/article types
  3. Article access tracking
  4. Updated license codes for flexible credit types

  Security:
  - Passwords stored as bcrypt hashes
  - RLS policies for row-level security
  - Separate from admin auth system
*/

-- 1. Users table for phone + password authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone_number);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admins can manage all users
DROP POLICY IF EXISTS "Admins can manage users" ON users;
CREATE POLICY "Admins can manage users" ON users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- 2. Enhanced user_credits table (drop and recreate for cleaner schema)
-- First, add new columns to existing user_credits
ALTER TABLE user_credits 
  ADD COLUMN IF NOT EXISTS video_watch_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS article_credits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_user_id uuid;

-- Add foreign key reference to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_credits_custom_user_id_fkey'
  ) THEN
    ALTER TABLE user_credits 
      ADD CONSTRAINT user_credits_custom_user_id_fkey 
      FOREIGN KEY (custom_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_credits_custom_user_idx ON user_credits(custom_user_id);

-- 3. Enhanced license_codes table
ALTER TABLE license_codes
  ADD COLUMN IF NOT EXISTS credit_type text DEFAULT 'universal', -- 'video', 'article', 'universal', 'both'
  ADD COLUMN IF NOT EXISTS video_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS article_count integer DEFAULT 0;

-- Add constraint for credit_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'license_codes_credit_type_check'
  ) THEN
    ALTER TABLE license_codes 
      ADD CONSTRAINT license_codes_credit_type_check 
      CHECK (credit_type IN ('video', 'article', 'universal', 'both'));
  END IF;
END $$;

-- 4. Article access table
CREATE TABLE IF NOT EXISTS article_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  article_id uuid NOT NULL,
  access_date timestamptz DEFAULT now(),
  UNIQUE(user_id, article_id)
);

-- Add foreign key to articles if articles table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'articles') THEN
    ALTER TABLE article_access 
      ADD CONSTRAINT article_access_article_fkey 
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE article_access 
  ADD CONSTRAINT article_access_user_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS article_access_user_idx ON article_access(user_id);
CREATE INDEX IF NOT EXISTS article_access_article_idx ON article_access(article_id);

ALTER TABLE article_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own article access" ON article_access;
CREATE POLICY "Users can view own article access" ON article_access
  FOR SELECT TO authenticated
  USING (user_id::text = auth.uid()::text OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- 5. Add credits_required to articles table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'articles') THEN
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS credits_required integer DEFAULT 0;
  END IF;
END $$;

-- 6. User sessions table for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash text NOT NULL,
  device_info text,
  ip_address text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_token_idx ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
CREATE POLICY "Users can manage own sessions" ON user_sessions
  FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text);

-- 7. Add custom_user_id to existing tables
ALTER TABLE course_access ADD COLUMN IF NOT EXISTS custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_quiz_attempts ADD COLUMN IF NOT EXISTS custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS course_access_custom_user_idx ON course_access(custom_user_id);
CREATE INDEX IF NOT EXISTS user_quiz_attempts_custom_user_idx ON user_quiz_attempts(custom_user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_custom_user_idx ON credit_transactions(custom_user_id);

-- 7. Updated redeem_license_code function for new credit types
CREATE OR REPLACE FUNCTION redeem_license_code_v2(p_code text, p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_license_record license_codes%ROWTYPE;
  v_current_balance integer;
  v_current_video_minutes integer;
  v_current_article_credits integer;
  v_new_balance integer;
  v_new_video_minutes integer;
  v_new_article_credits integer;
BEGIN
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
  SET is_redeemed = true, redeemed_by = p_user_id, redeemed_at = now()
  WHERE id = v_license_record.id;
  
  -- Get or create user credits record
  INSERT INTO user_credits (custom_user_id, balance, total_earned, video_watch_minutes, article_credits)
  VALUES (p_user_id, 0, 0, 0, 0)
  ON CONFLICT (custom_user_id) DO NOTHING;
  
  SELECT balance, video_watch_minutes, article_credits 
  INTO v_current_balance, v_current_video_minutes, v_current_article_credits
  FROM user_credits WHERE custom_user_id = p_user_id;
  
  -- Calculate new values based on credit type
  v_new_balance := v_current_balance;
  v_new_video_minutes := v_current_video_minutes;
  v_new_article_credits := v_current_article_credits;
  
  CASE v_license_record.credit_type
    WHEN 'video' THEN
      v_new_video_minutes := v_current_video_minutes + COALESCE(v_license_record.video_minutes, v_license_record.credit_amount);
    WHEN 'article' THEN
      v_new_article_credits := v_current_article_credits + COALESCE(v_license_record.article_count, v_license_record.credit_amount);
    WHEN 'both' THEN
      v_new_video_minutes := v_current_video_minutes + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits := v_current_article_credits + COALESCE(v_license_record.article_count, 0);
    ELSE -- 'universal'
      v_new_balance := v_current_balance + v_license_record.credit_amount;
  END CASE;
  
  -- Update balance
  UPDATE user_credits 
  SET balance = v_new_balance,
      video_watch_minutes = v_new_video_minutes,
      article_credits = v_new_article_credits,
      total_earned = total_earned + COALESCE(v_license_record.credit_amount, 0),
      updated_at = now()
  WHERE custom_user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (
    user_id, transaction_type, amount, description, 
    balance_before, balance_after, related_entity_type, related_entity_id,
    metadata
  ) VALUES (
    p_user_id, 'redeem', 
    COALESCE(v_license_record.credit_amount, v_license_record.video_minutes, v_license_record.article_count), 
    'شحن رصيد عبر كود',
    v_current_balance, v_new_balance, 'license_code', v_license_record.id,
    jsonb_build_object(
      'credit_type', v_license_record.credit_type,
      'video_minutes_added', v_new_video_minutes - v_current_video_minutes,
      'article_credits_added', v_new_article_credits - v_current_article_credits
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'تم شحن الرصيد بنجاح', 
    'new_balance', v_new_balance,
    'video_minutes', v_new_video_minutes,
    'article_credits', v_new_article_credits,
    'credit_type', v_license_record.credit_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to consume video watch time
CREATE OR REPLACE FUNCTION consume_video_minutes(p_user_id uuid, p_minutes integer, p_course_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current_minutes integer;
  v_current_balance integer;
  v_new_minutes integer;
BEGIN
  SELECT video_watch_minutes, balance INTO v_current_minutes, v_current_balance
  FROM user_credits WHERE custom_user_id = p_user_id;
  
  IF v_current_minutes IS NULL THEN
    v_current_minutes := 0;
    v_current_balance := 0;
  END IF;
  
  -- First try to use video minutes, then fall back to universal balance
  IF v_current_minutes >= p_minutes THEN
    v_new_minutes := v_current_minutes - p_minutes;
    
    UPDATE user_credits 
    SET video_watch_minutes = v_new_minutes, updated_at = now()
    WHERE custom_user_id = p_user_id;
    
    INSERT INTO credit_transactions (
      user_id, transaction_type, amount, description,
      balance_before, balance_after, related_entity_type, related_entity_id
    ) VALUES (
      p_user_id, 'usage', -p_minutes, 'استهلاك وقت مشاهدة',
      v_current_minutes, v_new_minutes, 'video_course', p_course_id
    );
    
    RETURN jsonb_build_object('success', true, 'remaining_minutes', v_new_minutes);
  ELSIF v_current_balance >= p_minutes THEN
    -- Use universal credits
    UPDATE user_credits 
    SET balance = balance - p_minutes, 
        total_spent = total_spent + p_minutes,
        updated_at = now()
    WHERE custom_user_id = p_user_id;
    
    RETURN jsonb_build_object('success', true, 'remaining_balance', v_current_balance - p_minutes);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'رصيد غير كافي');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to consume article credits
CREATE OR REPLACE FUNCTION consume_article_credit(p_user_id uuid, p_article_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current_credits integer;
  v_current_balance integer;
  v_already_has_access boolean;
BEGIN
  -- Check if already has access
  SELECT EXISTS(
    SELECT 1 FROM article_access WHERE user_id = p_user_id AND article_id = p_article_id
  ) INTO v_already_has_access;
  
  IF v_already_has_access THEN
    RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
  END IF;
  
  SELECT article_credits, balance INTO v_current_credits, v_current_balance
  FROM user_credits WHERE custom_user_id = p_user_id;
  
  IF v_current_credits IS NULL THEN
    v_current_credits := 0;
    v_current_balance := 0;
  END IF;
  
  -- First try article credits, then universal balance
  IF v_current_credits >= 1 THEN
    UPDATE user_credits 
    SET article_credits = article_credits - 1, updated_at = now()
    WHERE custom_user_id = p_user_id;
    
    INSERT INTO article_access (user_id, article_id)
    VALUES (p_user_id, p_article_id);
    
    INSERT INTO credit_transactions (
      user_id, transaction_type, amount, description,
      balance_before, balance_after, related_entity_type, related_entity_id
    ) VALUES (
      p_user_id, 'usage', -1, 'فتح مقال',
      v_current_credits, v_current_credits - 1, 'article', p_article_id
    );
    
    RETURN jsonb_build_object('success', true, 'remaining_credits', v_current_credits - 1);
  ELSIF v_current_balance >= 1 THEN
    UPDATE user_credits 
    SET balance = balance - 1, 
        total_spent = total_spent + 1,
        updated_at = now()
    WHERE custom_user_id = p_user_id;
    
    INSERT INTO article_access (user_id, article_id)
    VALUES (p_user_id, p_article_id);
    
    RETURN jsonb_build_object('success', true, 'remaining_balance', v_current_balance - 1);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'رصيد غير كافي');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
