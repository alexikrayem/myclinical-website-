-- =====================================================
-- Industry Standard Credit System Improvements
-- =====================================================

-- =========================
-- 1) Add expires_at to license_codes
-- =========================
ALTER TABLE license_codes
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Set a default expiration of 1 year for existing unredeemed codes if desired
UPDATE license_codes SET expires_at = now() + interval '1 year' WHERE is_redeemed = false AND expires_at IS NULL;

-- =========================
-- 2) generate_license_codes_v4
--    Increases entropy to 8 bytes (16 hex chars)
--    and sets an expires_at boundary automatically
-- =========================
CREATE OR REPLACE FUNCTION generate_license_codes_v4(
    p_amount INTEGER,
    p_credit_value INTEGER,
    p_prefix TEXT DEFAULT 'GIFT',
    p_credit_type TEXT DEFAULT 'universal',
    p_video_minutes INTEGER DEFAULT 0,
    p_article_count INTEGER DEFAULT 0,
    p_research_count INTEGER DEFAULT 0,
    p_credit_type_id UUID DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 365
) RETURNS TABLE (code TEXT) AS $$
DECLARE
    v_i INTEGER;
    v_new_code TEXT;
    v_random_hex TEXT;
BEGIN
    FOR v_i IN 1..p_amount LOOP
        -- 8 bytes of true randomness = 16 hex characters
        v_random_hex := upper(encode(gen_random_bytes(8), 'hex'));

        -- Format: PREFIX-XXXX-XXXX-XXXX-XXXX
        v_new_code := p_prefix || '-' ||
                     substring(v_random_hex from 1 for 4) || '-' ||
                     substring(v_random_hex from 5 for 4) || '-' ||
                     substring(v_random_hex from 9 for 4) || '-' ||
                     substring(v_random_hex from 13 for 4);

        INSERT INTO license_codes (
            code,
            credit_amount,
            credit_type,
            video_minutes,
            article_count,
            research_count,
            credit_type_id,
            expires_at,
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
            now() + (p_expires_in_days || ' days')::interval,
            now()
        );

        code := v_new_code;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================
-- 3) redeem_license_code_v3
--    Checks expiration and accepts IP metadata
-- =========================
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

    -- Merge metadata with typed info
    v_final_metadata := p_metadata || jsonb_build_object(
        'credit_type', 'typed',
        'credit_type_id', v_license_record.credit_type_id,
        'credit_type_name', v_type_name,
        'typed_credits_added', v_license_record.credit_amount
    );

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

  v_final_metadata := p_metadata || jsonb_build_object(
      'credit_type', v_license_record.credit_type,
      'video_minutes_added', v_new_video_minutes - v_current_video_minutes,
      'article_credits_added', v_new_article_credits - v_current_article_credits,
      'research_credits_added', v_new_research_credits - v_current_research_credits
  );

  INSERT INTO credit_transactions (
    user_id, custom_user_id, transaction_type, amount,
    description, balance_before, balance_after,
    related_entity_type, related_entity_id, metadata
  )
  VALUES (
    NULL, p_user_id, 'redeem',
    COALESCE(v_license_record.credit_amount, v_license_record.video_minutes,
             v_license_record.article_count, v_license_record.research_count, 0),
    'شحن رصيد عبر كود',
    v_current_balance, v_new_balance,
    'license_code', v_license_record.id,
    v_final_metadata
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
