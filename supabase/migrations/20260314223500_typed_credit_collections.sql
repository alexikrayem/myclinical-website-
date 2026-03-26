-- =====================================================
-- Typed Credit Collections
-- =====================================================
-- Allows admins to create credit "types" (bundles) that
-- are linked to specific courses. Users who redeem codes
-- of that type receive scoped credits usable ONLY on
-- the courses in that collection.
-- =====================================================

-- =========================
-- 1) credit_types table
-- =========================
CREATE TABLE IF NOT EXISTS credit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prefix text NOT NULL,           -- used as code prefix, e.g. 'SURG'
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE credit_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage credit types" ON credit_types;
CREATE POLICY "Admins can manage credit types" ON credit_types
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Allow public read so course pages can display type info
DROP POLICY IF EXISTS "Public can read active credit types" ON credit_types;
CREATE POLICY "Public can read active credit types" ON credit_types
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- =========================
-- 2) credit_type_courses junction
-- =========================
CREATE TABLE IF NOT EXISTS credit_type_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_type_id uuid REFERENCES credit_types(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES video_courses(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(credit_type_id, course_id)
);

CREATE INDEX IF NOT EXISTS ctc_type_idx ON credit_type_courses(credit_type_id);
CREATE INDEX IF NOT EXISTS ctc_course_idx ON credit_type_courses(course_id);

ALTER TABLE credit_type_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage credit type courses" ON credit_type_courses;
CREATE POLICY "Admins can manage credit type courses" ON credit_type_courses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

DROP POLICY IF EXISTS "Public can read credit type courses" ON credit_type_courses;
CREATE POLICY "Public can read credit type courses" ON credit_type_courses
  FOR SELECT TO anon, authenticated
  USING (true);

-- =========================
-- 3) user_typed_credits
-- =========================
CREATE TABLE IF NOT EXISTS user_typed_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  credit_type_id uuid REFERENCES credit_types(id) ON DELETE CASCADE NOT NULL,
  balance integer DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, credit_type_id)
);

CREATE INDEX IF NOT EXISTS utc_user_idx ON user_typed_credits(user_id);
CREATE INDEX IF NOT EXISTS utc_type_idx ON user_typed_credits(credit_type_id);

ALTER TABLE user_typed_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own typed credits" ON user_typed_credits;
CREATE POLICY "Users can view own typed credits" ON user_typed_credits
  FOR SELECT TO authenticated
  USING (
    user_id::text = auth.uid()::text
    OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

-- =========================
-- 4) Add credit_type_id to license_codes
-- =========================
ALTER TABLE license_codes
  ADD COLUMN IF NOT EXISTS credit_type_id uuid REFERENCES credit_types(id) ON DELETE SET NULL;

-- Update the credit_type CHECK constraint to allow 'typed'
DO $$
BEGIN
  ALTER TABLE license_codes DROP CONSTRAINT IF EXISTS license_codes_credit_type_check;

  ALTER TABLE license_codes
    ADD CONSTRAINT license_codes_credit_type_check
    CHECK (credit_type IN ('video', 'article', 'universal', 'both', 'research', 'all', 'typed'));
END $$;

-- =========================
-- 5) Update redeem_license_code_v2
--    Handle credit_type = 'typed'
-- =========================
CREATE OR REPLACE FUNCTION redeem_license_code_v2(
  p_code text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_record license_codes%ROWTYPE;
  v_current_balance integer;
  v_current_video_minutes integer;
  v_current_article_credits integer;
  v_current_research_credits integer;

  v_new_balance integer;
  v_new_video_minutes integer;
  v_new_article_credits integer;
  v_new_research_credits integer;

  v_typed_balance integer;
  v_type_name text;
BEGIN

  -- Lock the code row to prevent double redemption
  SELECT *
  INTO v_license_record
  FROM license_codes
  WHERE code = p_code
  FOR UPDATE;

  IF v_license_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز غير صحيح'
    );
  END IF;

  IF v_license_record.is_redeemed THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'تم استخدام هذا الرمز مسبقاً'
    );
  END IF;

  -- Mark as redeemed
  UPDATE license_codes
  SET
    is_redeemed = true,
    custom_redeemed_by = p_user_id,
    redeemed_at = now()
  WHERE id = v_license_record.id;

  -- =====================
  -- TYPED CREDIT PATH
  -- =====================
  IF v_license_record.credit_type = 'typed' AND v_license_record.credit_type_id IS NOT NULL THEN

    -- Get type name for response
    SELECT name INTO v_type_name
    FROM credit_types
    WHERE id = v_license_record.credit_type_id;

    -- Upsert typed credit balance
    INSERT INTO user_typed_credits (user_id, credit_type_id, balance)
    VALUES (p_user_id, v_license_record.credit_type_id, v_license_record.credit_amount)
    ON CONFLICT (user_id, credit_type_id)
    DO UPDATE SET
      balance = user_typed_credits.balance + EXCLUDED.balance,
      updated_at = now();

    -- Get the new typed balance
    SELECT balance INTO v_typed_balance
    FROM user_typed_credits
    WHERE user_id = p_user_id AND credit_type_id = v_license_record.credit_type_id;

    -- Log the transaction
    INSERT INTO credit_transactions (
      user_id, custom_user_id, transaction_type, amount,
      description, balance_before, balance_after,
      related_entity_type, related_entity_id, metadata
    )
    VALUES (
      NULL, p_user_id, 'redeem', v_license_record.credit_amount,
      'شحن رصيد مخصص عبر كود',
      COALESCE(v_typed_balance - v_license_record.credit_amount, 0),
      v_typed_balance,
      'license_code', v_license_record.id,
      jsonb_build_object(
        'credit_type', 'typed',
        'credit_type_id', v_license_record.credit_type_id,
        'credit_type_name', v_type_name,
        'typed_credits_added', v_license_record.credit_amount
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'تم شحن الرصيد المخصص بنجاح',
      'credit_type', 'typed',
      'credit_type_id', v_license_record.credit_type_id,
      'credit_type_name', v_type_name,
      'typed_balance', v_typed_balance
    );

  END IF;

  -- =====================
  -- GENERIC CREDIT PATH (unchanged)
  -- =====================

  -- Ensure credits row exists
  INSERT INTO user_credits (
    custom_user_id, balance, total_earned,
    video_watch_minutes, article_credits, research_credits
  )
  VALUES (p_user_id,0,0,0,0,0)
  ON CONFLICT (custom_user_id) DO NOTHING;

  -- Lock credit row
  SELECT
    balance, video_watch_minutes, article_credits,
    COALESCE(research_credits, 0)
  INTO
    v_current_balance, v_current_video_minutes,
    v_current_article_credits, v_current_research_credits
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  v_new_balance := v_current_balance;
  v_new_video_minutes := v_current_video_minutes;
  v_new_article_credits := v_current_article_credits;
  v_new_research_credits := v_current_research_credits;

  CASE v_license_record.credit_type

    WHEN 'video' THEN
      v_new_video_minutes :=
        v_current_video_minutes +
        COALESCE(v_license_record.video_minutes, v_license_record.credit_amount);

    WHEN 'article' THEN
      v_new_article_credits :=
        v_current_article_credits +
        COALESCE(v_license_record.article_count, v_license_record.credit_amount);

    WHEN 'both' THEN
      v_new_video_minutes :=
        v_current_video_minutes + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits :=
        v_current_article_credits + COALESCE(v_license_record.article_count, 0);

    WHEN 'research' THEN
      v_new_research_credits :=
        v_current_research_credits +
        COALESCE(v_license_record.research_count, v_license_record.credit_amount);

    WHEN 'all' THEN
      v_new_video_minutes := v_current_video_minutes + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits := v_current_article_credits + COALESCE(v_license_record.article_count, 0);
      v_new_research_credits := v_current_research_credits + COALESCE(v_license_record.research_count, 0);

    ELSE
      -- 'universal' or any unlisted type
      v_new_balance := v_current_balance + v_license_record.credit_amount;

  END CASE;

  UPDATE user_credits
  SET
    balance = v_new_balance,
    video_watch_minutes = v_new_video_minutes,
    article_credits = v_new_article_credits,
    research_credits = v_new_research_credits,
    total_earned = total_earned + COALESCE(v_license_record.credit_amount, 0),
    updated_at = now()
  WHERE custom_user_id = p_user_id;

  INSERT INTO credit_transactions (
    user_id, custom_user_id, transaction_type, amount,
    description, balance_before, balance_after,
    related_entity_type, related_entity_id, metadata
  )
  VALUES (
    NULL, p_user_id, 'redeem',
    COALESCE(v_license_record.credit_amount, v_license_record.video_minutes,
             v_license_record.article_count, v_license_record.research_count),
    'شحن رصيد عبر كود',
    v_current_balance, v_new_balance,
    'license_code', v_license_record.id,
    jsonb_build_object(
      'credit_type', v_license_record.credit_type,
      'video_minutes_added', v_new_video_minutes - v_current_video_minutes,
      'article_credits_added', v_new_article_credits - v_current_article_credits,
      'research_credits_added', v_new_research_credits - v_current_research_credits
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم شحن الرصيد بنجاح',
    'new_balance', v_new_balance,
    'video_minutes', v_new_video_minutes,
    'article_credits', v_new_article_credits,
    'research_credits', v_new_research_credits,
    'credit_type', v_license_record.credit_type
  );

END;
$$;


-- =========================
-- 6) Update purchase_course_access
--    Check typed credits FIRST, then fall back to universal balance
-- =========================
CREATE OR REPLACE FUNCTION purchase_course_access(
  p_course_id uuid,
  p_user_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_course RECORD;
  v_current_balance integer;
  v_already_has_access boolean;
  v_already_processed boolean;
  v_typed_record RECORD;
  v_used_typed boolean := false;
  v_typed_type_name text;
BEGIN
  -- Check if already has access
  SELECT EXISTS(
    SELECT 1 FROM course_access WHERE custom_user_id = p_user_id AND course_id = p_course_id
  ) INTO v_already_has_access;

  IF v_already_has_access THEN
    RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM credit_transactions
      WHERE custom_user_id = p_user_id
        AND related_entity_type = 'course_access'
        AND related_entity_id = p_course_id
        AND metadata->>'idempotency_key' = p_idempotency_key
    ) INTO v_already_processed;

    IF v_already_processed THEN
      RETURN jsonb_build_object('success', true, 'message', 'تمت معالجة الطلب مسبقاً');
    END IF;
  END IF;

  -- Get course info
  SELECT credits_required, title, billing_model INTO v_course
  FROM video_courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Course not found');
  END IF;

  IF v_course.billing_model <> 'per_course' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This course uses per-minute billing');
  END IF;

  -- =====================
  -- TRY TYPED CREDITS FIRST
  -- =====================
  -- Find a typed credit balance where this course is in the collection
  SELECT utc.id, utc.credit_type_id, utc.balance, ct.name
  INTO v_typed_record
  FROM user_typed_credits utc
  JOIN credit_type_courses ctc ON ctc.credit_type_id = utc.credit_type_id
  JOIN credit_types ct ON ct.id = utc.credit_type_id
  WHERE utc.user_id = p_user_id
    AND ctc.course_id = p_course_id
    AND utc.balance >= v_course.credits_required
  ORDER BY utc.balance ASC  -- use smallest sufficient balance first
  LIMIT 1
  FOR UPDATE OF utc;

  IF v_typed_record.id IS NOT NULL THEN
    -- Deduct typed credits
    UPDATE user_typed_credits
    SET balance = balance - v_course.credits_required,
        updated_at = now()
    WHERE id = v_typed_record.id;

    v_used_typed := true;
    v_typed_type_name := v_typed_record.name;

    -- Grant access
    INSERT INTO course_access (custom_user_id, course_id, access_date)
    VALUES (p_user_id, p_course_id, now());

    -- Record transaction
    INSERT INTO credit_transactions (
      user_id, custom_user_id, transaction_type, amount,
      description, balance_before, balance_after,
      related_entity_type, related_entity_id, metadata
    ) VALUES (
      NULL, p_user_id, 'usage', -v_course.credits_required,
      'شراء كورس: ' || v_course.title,
      v_typed_record.balance,
      v_typed_record.balance - v_course.credits_required,
      'course_access', p_course_id,
      jsonb_build_object(
        'payment_method', 'typed_credit',
        'credit_type_id', v_typed_record.credit_type_id,
        'credit_type_name', v_typed_type_name,
        'idempotency_key', COALESCE(p_idempotency_key, '')
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'تم شراء الكورس بنجاح باستخدام رصيد ' || v_typed_type_name
    );
  END IF;

  -- =====================
  -- FALL BACK TO UNIVERSAL BALANCE
  -- =====================

  -- Ensure credit row exists
  INSERT INTO user_credits (custom_user_id, balance, total_earned, video_watch_minutes, article_credits)
  VALUES (p_user_id, 0, 0, 0, 0)
  ON CONFLICT (custom_user_id) DO NOTHING;

  -- Lock user credits row
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance < v_course.credits_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رصيد غير كافي',
      'required', v_course.credits_required,
      'current', v_current_balance
    );
  END IF;

  -- Deduct credits
  UPDATE user_credits
  SET balance = balance - v_course.credits_required,
      total_spent = total_spent + v_course.credits_required,
      updated_at = now()
  WHERE custom_user_id = p_user_id;

  -- Grant access
  INSERT INTO course_access (custom_user_id, course_id, access_date)
  VALUES (p_user_id, p_course_id, now());

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id, custom_user_id, transaction_type, amount,
    description, balance_before, balance_after,
    related_entity_type, related_entity_id, metadata
  ) VALUES (
    NULL, p_user_id, 'usage', -v_course.credits_required,
    'شراء كورس: ' || v_course.title,
    v_current_balance,
    v_current_balance - v_course.credits_required,
    'course_access', p_course_id,
    jsonb_build_object(
      'payment_method', 'universal_balance',
      'idempotency_key', COALESCE(p_idempotency_key, '')
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم شراء الكورس بنجاح');
END;
$$;


-- =========================
-- 7) generate_license_codes_v3
--    Supports typed credit codes
-- =========================
CREATE OR REPLACE FUNCTION generate_license_codes_v3(
    p_amount INTEGER,
    p_credit_value INTEGER,
    p_prefix TEXT DEFAULT 'GIFT',
    p_credit_type TEXT DEFAULT 'universal',
    p_video_minutes INTEGER DEFAULT 0,
    p_article_count INTEGER DEFAULT 0,
    p_research_count INTEGER DEFAULT 0,
    p_credit_type_id UUID DEFAULT NULL
) RETURNS TABLE (code TEXT) AS $$
DECLARE
    v_i INTEGER;
    v_new_code TEXT;
    v_random_hex TEXT;
BEGIN
    FOR v_i IN 1..p_amount LOOP
        v_random_hex := upper(encode(gen_random_bytes(6), 'hex'));

        v_new_code := p_prefix || '-' ||
                     substring(v_random_hex from 1 for 4) || '-' ||
                     substring(v_random_hex from 5 for 4) || '-' ||
                     substring(v_random_hex from 9 for 4);

        INSERT INTO license_codes (
            code,
            credit_amount,
            credit_type,
            video_minutes,
            article_count,
            research_count,
            credit_type_id,
            created_at
        )
        VALUES (
            v_new_code,
            p_credit_value,
            p_credit_type,
            p_video_minutes,
            p_article_count,
            p_research_count,
            p_credit_type_id,
            now()
        );

        code := v_new_code;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
