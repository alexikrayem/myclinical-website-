-- =====================================================
-- Fix #15: Correct transaction amount for non-universal
-- credit redemptions in redeem_license_code_v3.
--
-- The previous COALESCE chain always used credit_amount first,
-- which logged 0 for pure video/article/research codes that
-- store their value in video_minutes/article_count/research_count
-- rather than credit_amount.
-- =====================================================

CREATE OR REPLACE FUNCTION redeem_license_code_v3(
  p_code text,
  p_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
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

  v_final_metadata jsonb;
  -- Fix #15: track the canonical logged amount per credit type
  v_logged_amount integer;
BEGIN

  -- Lock the code row to prevent double redemption
  SELECT *
  INTO v_license_record
  FROM license_codes
  WHERE code = p_code
  FOR UPDATE;

  -- 1. Existence check
  IF v_license_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رمز غير صحيح'
    );
  END IF;

  -- 2. Redemption check
  IF v_license_record.is_redeemed THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'تم استخدام هذا الرمز مسبقاً'
    );
  END IF;

  -- 3. Expiration check
  IF v_license_record.expires_at IS NOT NULL AND v_license_record.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'انتهت صلاحية هذا الرمز'
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

    SELECT name INTO v_type_name
    FROM credit_types
    WHERE id = v_license_record.credit_type_id;

    INSERT INTO user_typed_credits (user_id, credit_type_id, balance)
    VALUES (p_user_id, v_license_record.credit_type_id, v_license_record.credit_amount)
    ON CONFLICT (user_id, credit_type_id)
    DO UPDATE SET
      balance = user_typed_credits.balance + EXCLUDED.balance,
      updated_at = now();

    SELECT balance INTO v_typed_balance
    FROM user_typed_credits
    WHERE user_id = p_user_id AND credit_type_id = v_license_record.credit_type_id;

    v_final_metadata := p_metadata || jsonb_build_object(
        'credit_type', 'typed',
        'credit_type_id', v_license_record.credit_type_id,
        'credit_type_name', v_type_name,
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
      'success', true,
      'message', 'تم شحن الرصيد المخصص بنجاح',
      'credit_type', 'typed',
      'credit_type_id', v_license_record.credit_type_id,
      'credit_type_name', v_type_name,
      'typed_balance', v_typed_balance
    );

  END IF;

  -- =====================
  -- GENERIC CREDIT PATH
  -- =====================

  INSERT INTO user_credits (
    custom_user_id, balance, total_earned,
    video_watch_minutes, article_credits, research_credits
  )
  VALUES (p_user_id,0,0,0,0,0)
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

  v_new_balance          := v_current_balance;
  v_new_video_minutes    := v_current_video_minutes;
  v_new_article_credits  := v_current_article_credits;
  v_new_research_credits := v_current_research_credits;

  CASE v_license_record.credit_type

    WHEN 'video' THEN
      v_new_video_minutes :=
        v_current_video_minutes +
        COALESCE(v_license_record.video_minutes, v_license_record.credit_amount);
      -- Fix #15: log the actual minutes added, not credit_amount (which may be 0)
      v_logged_amount := COALESCE(v_license_record.video_minutes, v_license_record.credit_amount, 0);

    WHEN 'article' THEN
      v_new_article_credits :=
        v_current_article_credits +
        COALESCE(v_license_record.article_count, v_license_record.credit_amount);
      -- Fix #15: log actual article credits added
      v_logged_amount := COALESCE(v_license_record.article_count, v_license_record.credit_amount, 0);

    WHEN 'both' THEN
      v_new_video_minutes :=
        v_current_video_minutes + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits :=
        v_current_article_credits + COALESCE(v_license_record.article_count, 0);
      -- Fix #15: for compound types, sum both values
      v_logged_amount :=
        COALESCE(v_license_record.video_minutes, 0) +
        COALESCE(v_license_record.article_count, 0);

    WHEN 'research' THEN
      v_new_research_credits :=
        v_current_research_credits +
        COALESCE(v_license_record.research_count, v_license_record.credit_amount);
      -- Fix #15: log actual research credits added
      v_logged_amount := COALESCE(v_license_record.research_count, v_license_record.credit_amount, 0);

    WHEN 'all' THEN
      v_new_video_minutes    := v_current_video_minutes    + COALESCE(v_license_record.video_minutes, 0);
      v_new_article_credits  := v_current_article_credits  + COALESCE(v_license_record.article_count, 0);
      v_new_research_credits := v_current_research_credits + COALESCE(v_license_record.research_count, 0);
      -- Fix #15: sum all three for the logged amount
      v_logged_amount :=
        COALESCE(v_license_record.video_minutes, 0) +
        COALESCE(v_license_record.article_count, 0) +
        COALESCE(v_license_record.research_count, 0);

    ELSE
      -- 'universal' or any unlisted type: credit_amount goes to balance
      v_new_balance   := v_current_balance + v_license_record.credit_amount;
      v_logged_amount := COALESCE(v_license_record.credit_amount, 0);

  END CASE;

  UPDATE user_credits
  SET
    balance              = v_new_balance,
    video_watch_minutes  = v_new_video_minutes,
    article_credits      = v_new_article_credits,
    research_credits     = v_new_research_credits,
    total_earned         = total_earned + COALESCE(v_license_record.credit_amount, 0),
    updated_at           = now()
  WHERE custom_user_id = p_user_id;

  v_final_metadata := p_metadata || jsonb_build_object(
      'credit_type',             v_license_record.credit_type,
      'video_minutes_added',     v_new_video_minutes    - v_current_video_minutes,
      'article_credits_added',   v_new_article_credits  - v_current_article_credits,
      'research_credits_added',  v_new_research_credits - v_current_research_credits
  );

  INSERT INTO credit_transactions (
    user_id, custom_user_id, transaction_type, amount,
    description, balance_before, balance_after,
    related_entity_type, related_entity_id, metadata
  )
  VALUES (
    NULL, p_user_id, 'redeem',
    -- Fix #15: use v_logged_amount — the actual value credited for this type
    v_logged_amount,
    'شحن رصيد عبر كود',
    v_current_balance, v_new_balance,
    'license_code', v_license_record.id,
    v_final_metadata
  );

  RETURN jsonb_build_object(
    'success',          true,
    'message',          'تم شحن الرصيد بنجاح',
    'new_balance',      v_new_balance,
    'video_minutes',    v_new_video_minutes,
    'article_credits',  v_new_article_credits,
    'research_credits', v_new_research_credits,
    'credit_type',      v_license_record.credit_type
  );

END;
$$;
