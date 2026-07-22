-- =====================================================
-- Fix Credit Consume Race Condition (C1)
-- and total_earned Accumulation Bug (C3)
-- =====================================================
-- C1: Close the TOCTOU window in consume_article_credit
--     and consume_research_credit by acquiring the FOR UPDATE
--     lock on user_credits BEFORE checking whether access
--     already exists. This prevents two concurrent requests
--     from both observing "no access" and double-deducting.
--
-- C3: Fix total_earned in redeem_license_code_v3 to sum
--     the actual deltas across all credit dimensions
--     instead of using credit_amount (which is 0 for
--     video-only and research-only codes).
-- =====================================================


-- ===================
-- 1. consume_article_credit  (C1 fix)
-- ===================
CREATE OR REPLACE FUNCTION consume_article_credit(
  p_user_id uuid,
  p_article_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits integer;
  v_current_balance integer;
  v_new_credits     integer;
  v_new_balance     integer;
BEGIN

  -- ► Acquire row-level lock on user_credits FIRST.
  --   Both concurrent callers will now serialize here;
  --   the second one will see the access row inserted by
  --   the first and exit early — no double-deduction.
  SELECT
    article_credits,
    balance
  INTO
    v_current_credits,
    v_current_balance
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  -- Guard: no credits row yet (edge case for brand-new users)
  IF v_current_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا يوجد رصيد');
  END IF;

  -- Idempotency: check access AFTER acquiring the lock
  IF EXISTS (
    SELECT 1 FROM article_access
    WHERE user_id = p_user_id AND article_id = p_article_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
  END IF;

  v_new_credits := v_current_credits;
  v_new_balance := v_current_balance;

  IF v_current_credits >= 1 THEN

    v_new_credits := v_current_credits - 1;
    UPDATE user_credits
    SET
      article_credits = v_new_credits,
      updated_at      = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    v_new_balance := v_current_balance - 1;
    UPDATE user_credits
    SET
      balance     = v_new_balance,
      total_spent = total_spent + 1,
      updated_at  = now()
    WHERE custom_user_id = p_user_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'رصيد غير كافي');
  END IF;

  INSERT INTO article_access (user_id, article_id)
  VALUES (p_user_id, p_article_id);

  RETURN jsonb_build_object(
    'success',           true,
    'message',           'تم فتح المقال بنجاح',
    'remaining_credits', v_new_credits,
    'remaining_balance', v_new_balance
  );

END;
$$;


-- ===================
-- 2. consume_research_credit  (C1 fix — same pattern)
-- ===================
CREATE OR REPLACE FUNCTION consume_research_credit(
  p_user_id    uuid,
  p_research_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits integer;
  v_current_balance integer;
  v_new_credits     integer;
  v_new_balance     integer;
BEGIN

  -- ► Acquire row-level lock on user_credits FIRST.
  SELECT
    research_credits,
    balance
  INTO
    v_current_credits,
    v_current_balance
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا يوجد رصيد');
  END IF;

  -- Idempotency: check access AFTER acquiring the lock
  IF EXISTS (
    SELECT 1 FROM research_access
    WHERE user_id = p_user_id AND research_id = p_research_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
  END IF;

  v_new_credits := v_current_credits;
  v_new_balance := v_current_balance;

  IF v_current_credits >= 1 THEN

    v_new_credits := v_current_credits - 1;
    UPDATE user_credits
    SET
      research_credits = v_new_credits,
      updated_at       = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    v_new_balance := v_current_balance - 1;
    UPDATE user_credits
    SET
      balance     = v_new_balance,
      total_spent = total_spent + 1,
      updated_at  = now()
    WHERE custom_user_id = p_user_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'رصيد غير كافي');
  END IF;

  INSERT INTO research_access (user_id, research_id)
  VALUES (p_user_id, p_research_id);

  RETURN jsonb_build_object(
    'success',           true,
    'message',           'تم فتح البحث بنجاح',
    'remaining_credits', v_new_credits,
    'remaining_balance', v_new_balance
  );

END;
$$;


-- ===================
-- 3. redeem_license_code_v3  (C3 fix — total_earned)
-- ===================
-- Replace only the UPDATE user_credits statement so that
-- total_earned reflects the sum of all actual credit deltas,
-- not just credit_amount (which is 0 for video/research-only codes).
CREATE OR REPLACE FUNCTION redeem_license_code_v3(
  p_code     text,
  p_user_id  uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_record             license_codes%ROWTYPE;
  v_current_balance            integer;
  v_current_video_minutes      integer;
  v_current_article_credits    integer;
  v_current_research_credits   integer;

  v_new_balance                integer;
  v_new_video_minutes          integer;
  v_new_article_credits        integer;
  v_new_research_credits       integer;

  v_typed_balance              integer;
  v_type_name                  text;

  v_final_metadata             jsonb;
  v_total_earned_delta         integer;
BEGIN

  -- Lock the code row to prevent double redemption
  SELECT *
  INTO v_license_record
  FROM license_codes
  WHERE code = p_code
  FOR UPDATE;

  -- 1. Existence check
  IF v_license_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'رمز غير صحيح');
  END IF;

  -- 2. Redemption check
  IF v_license_record.is_redeemed THEN
    RETURN jsonb_build_object('success', false, 'message', 'تم استخدام هذا الرمز مسبقاً');
  END IF;

  -- 3. Expiration check
  IF v_license_record.expires_at IS NOT NULL AND v_license_record.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'انتهت صلاحية هذا الرمز');
  END IF;

  -- Mark as redeemed
  UPDATE license_codes
  SET
    is_redeemed       = true,
    custom_redeemed_by = p_user_id,
    redeemed_at       = now()
  WHERE id = v_license_record.id;

  -- =====================
  -- TYPED CREDIT PATH
  -- =====================
  IF v_license_record.credit_type = 'typed' AND v_license_record.credit_type_id IS NOT NULL THEN

    SELECT name INTO v_type_name
    FROM credit_types
    WHERE id = v_license_record.credit_type_id;

    INSERT INTO user_typed_credits (user_id, credit_type_id, balance)
    VALUES (p_user_id, v_license_record.credit_type_id, v_license_record.credit_amount)
    ON CONFLICT (user_id, credit_type_id)
    DO UPDATE SET
      balance    = user_typed_credits.balance + EXCLUDED.balance,
      updated_at = now();

    SELECT balance INTO v_typed_balance
    FROM user_typed_credits
    WHERE user_id = p_user_id AND credit_type_id = v_license_record.credit_type_id;

    v_final_metadata := p_metadata || jsonb_build_object(
        'credit_type',        'typed',
        'credit_type_id',     v_license_record.credit_type_id,
        'credit_type_name',   v_type_name,
        'typed_credits_added', v_license_record.credit_amount
    );

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
      v_final_metadata
    );

    RETURN jsonb_build_object(
      'success',          true,
      'message',          'تم شحن الرصيد المخصص بنجاح',
      'credit_type',      'typed',
      'credit_type_id',   v_license_record.credit_type_id,
      'credit_type_name', v_type_name,
      'typed_balance',    v_typed_balance
    );

  END IF;

  -- =====================
  -- GENERIC CREDIT PATH
  -- =====================

  INSERT INTO user_credits (
    custom_user_id, balance, total_earned,
    video_watch_minutes, article_credits, research_credits
  )
  VALUES (p_user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (custom_user_id) DO NOTHING;

  SELECT
    balance, video_watch_minutes, article_credits,
    COALESCE(research_credits, 0)
  INTO
    v_current_balance, v_current_video_minutes,
    v_current_article_credits, v_current_research_credits
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  v_new_balance            := v_current_balance;
  v_new_video_minutes      := v_current_video_minutes;
  v_new_article_credits    := v_current_article_credits;
  v_new_research_credits   := v_current_research_credits;

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
      v_new_video_minutes   := v_current_video_minutes   + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits := v_current_article_credits + COALESCE(v_license_record.article_count, 0);

    WHEN 'research' THEN
      v_new_research_credits :=
        v_current_research_credits +
        COALESCE(v_license_record.research_count, v_license_record.credit_amount);

    WHEN 'all' THEN
      v_new_video_minutes    := v_current_video_minutes    + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits  := v_current_article_credits  + COALESCE(v_license_record.article_count, 0);
      v_new_research_credits := v_current_research_credits + COALESCE(v_license_record.research_count, 0);

    ELSE
      -- 'universal' and any future unlisted type
      v_new_balance := v_current_balance + v_license_record.credit_amount;

  END CASE;

  -- C3 FIX: total_earned is the sum of ALL actual deltas, not just credit_amount.
  -- This correctly accounts for video-only, research-only, and multi-dimension codes.
  v_total_earned_delta :=
    (v_new_balance          - v_current_balance)          +
    (v_new_video_minutes    - v_current_video_minutes)    +
    (v_new_article_credits  - v_current_article_credits)  +
    (v_new_research_credits - v_current_research_credits);

  UPDATE user_credits
  SET
    balance          = v_new_balance,
    video_watch_minutes = v_new_video_minutes,
    article_credits  = v_new_article_credits,
    research_credits = v_new_research_credits,
    total_earned     = total_earned + v_total_earned_delta,
    updated_at       = now()
  WHERE custom_user_id = p_user_id;

  v_final_metadata := p_metadata || jsonb_build_object(
      'credit_type',              v_license_record.credit_type,
      'video_minutes_added',      v_new_video_minutes    - v_current_video_minutes,
      'article_credits_added',    v_new_article_credits  - v_current_article_credits,
      'research_credits_added',   v_new_research_credits - v_current_research_credits
  );

  INSERT INTO credit_transactions (
    user_id, custom_user_id, transaction_type, amount,
    description, balance_before, balance_after,
    related_entity_type, related_entity_id, metadata
  )
  VALUES (
    NULL, p_user_id, 'redeem',
    v_total_earned_delta,
    'شحن رصيد عبر كود',
    v_current_balance, v_new_balance,
    'license_code', v_license_record.id,
    v_final_metadata
  );

  RETURN jsonb_build_object(
    'success',           true,
    'message',           'تم شحن الرصيد بنجاح',
    'new_balance',       v_new_balance,
    'video_minutes',     v_new_video_minutes,
    'article_credits',   v_new_article_credits,
    'research_credits',  v_new_research_credits,
    'credit_type',       v_license_record.credit_type
  );

END;
$$;
