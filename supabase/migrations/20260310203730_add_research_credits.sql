-- =====================================================
-- Expand Credits to Research Access
-- =====================================================

-- 1) Add credits_required to researches
ALTER TABLE researches
  ADD COLUMN IF NOT EXISTS credits_required integer DEFAULT 1;

-- 2) Add research_credits to user_credits
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS research_credits integer DEFAULT 0;

-- 3) Update license_codes enum and add research_count
ALTER TABLE license_codes
  ADD COLUMN IF NOT EXISTS research_count integer DEFAULT 0;

-- Drop and recreate the constraint to allow 'research' and 'all'
DO $$
BEGIN
  ALTER TABLE license_codes DROP CONSTRAINT IF EXISTS license_codes_credit_type_check;
  
  ALTER TABLE license_codes 
    ADD CONSTRAINT license_codes_credit_type_check 
    CHECK (credit_type IN ('video', 'article', 'universal', 'both', 'research', 'all'));
END $$;

-- 4) Research Access Table
CREATE TABLE IF NOT EXISTS research_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  research_id uuid REFERENCES researches(id) ON DELETE CASCADE NOT NULL,
  access_date timestamptz DEFAULT now(),
  UNIQUE(user_id, research_id)
);

CREATE INDEX IF NOT EXISTS research_access_user_idx ON research_access(user_id);
CREATE INDEX IF NOT EXISTS research_access_research_idx ON research_access(research_id);

ALTER TABLE research_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own research access" ON research_access;
CREATE POLICY "Users can view own research access" ON research_access
  FOR SELECT TO authenticated
  USING (user_id::text = auth.uid()::text OR EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- 5) consume_research_credit RPC
CREATE OR REPLACE FUNCTION consume_research_credit(
  p_user_id uuid,
  p_research_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits integer;
  v_current_balance integer;
  v_already_has_access boolean;
BEGIN

  -- Check if already has access before locking
  SELECT EXISTS(
    SELECT 1 FROM research_access WHERE user_id = p_user_id AND research_id = p_research_id
  ) INTO v_already_has_access;
  
  IF v_already_has_access THEN
    RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
  END IF;

  SELECT
    research_credits,
    balance
  INTO
    v_current_credits,
    v_current_balance
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  IF v_current_credits >= 1 THEN

    UPDATE user_credits
    SET
      research_credits = research_credits - 1,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    UPDATE user_credits
    SET
      balance = balance - 1,
      total_spent = total_spent + 1,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

  ELSE

    RETURN jsonb_build_object(
      'success', false,
      'message', 'رصيد غير كافي'
    );

  END IF;

  INSERT INTO research_access (user_id, research_id)
  VALUES (p_user_id, p_research_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم فتح البحث بنجاح'
  );

END;
$$;


-- 6) Update redeem_license_code_v2 to handle 'research' and 'all' types
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

  -- Ensure credits row exists
  INSERT INTO user_credits (
    custom_user_id,
    balance,
    total_earned,
    video_watch_minutes,
    article_credits,
    research_credits
  )
  VALUES (p_user_id,0,0,0,0,0)
  ON CONFLICT (custom_user_id) DO NOTHING;

  -- Lock credit row
  SELECT
    balance,
    video_watch_minutes,
    article_credits,
    COALESCE(research_credits, 0)
  INTO
    v_current_balance,
    v_current_video_minutes,
    v_current_article_credits,
    v_current_research_credits
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
        COALESCE(
          v_license_record.video_minutes,
          v_license_record.credit_amount
        );

    WHEN 'article' THEN
      v_new_article_credits :=
        v_current_article_credits +
        COALESCE(
          v_license_record.article_count,
          v_license_record.credit_amount
        );

    WHEN 'both' THEN
      v_new_video_minutes :=
        v_current_video_minutes +
        COALESCE(v_license_record.video_minutes,0);

      v_new_article_credits :=
        v_current_article_credits +
        COALESCE(v_license_record.article_count,0);

    WHEN 'research' THEN
      v_new_research_credits :=
        v_current_research_credits +
        COALESCE(
          v_license_record.research_count,
          v_license_record.credit_amount
        );

    WHEN 'all' THEN
      v_new_video_minutes := v_current_video_minutes + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits := v_current_article_credits + COALESCE(v_license_record.article_count, 0);
      v_new_research_credits := v_current_research_credits + COALESCE(v_license_record.research_count, 0);

    ELSE
      v_new_balance :=
        v_current_balance +
        v_license_record.credit_amount;

  END CASE;

  UPDATE user_credits
  SET
    balance = v_new_balance,
    video_watch_minutes = v_new_video_minutes,
    article_credits = v_new_article_credits,
    research_credits = v_new_research_credits,
    total_earned = total_earned + COALESCE(v_license_record.credit_amount,0),
    updated_at = now()
  WHERE custom_user_id = p_user_id;

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
  )
  VALUES (
    NULL,
    p_user_id,
    'redeem',
    COALESCE(
      v_license_record.credit_amount,
      v_license_record.video_minutes,
      v_license_record.article_count,
      v_license_record.research_count
    ),
    'شحن رصيد عبر كود',
    v_current_balance,
    v_new_balance,
    'license_code',
    v_license_record.id,
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
