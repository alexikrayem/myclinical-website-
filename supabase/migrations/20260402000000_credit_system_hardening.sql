-- =====================================================
-- Credit System Hardening
-- Adds logging for video minute fallbacks, returns remaining
-- balances for article and research credits.
-- =====================================================

-- 1. Update consume_video_minutes to log fallback usage
CREATE OR REPLACE FUNCTION consume_video_minutes(
  p_user_id uuid,
  p_minutes integer,
  p_course_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_minutes integer;
  v_current_balance integer;
  v_new_minutes integer;
BEGIN

  SELECT
    video_watch_minutes,
    balance
  INTO
    v_current_minutes,
    v_current_balance
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  IF v_current_minutes IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'لا يوجد رصيد'
    );
  END IF;

  IF v_current_minutes >= p_minutes THEN

    v_new_minutes := v_current_minutes - p_minutes;

    UPDATE user_credits
    SET
      video_watch_minutes = v_new_minutes,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

    INSERT INTO credit_transactions (
      user_id, custom_user_id, transaction_type, amount,
      description, balance_before, balance_after,
      related_entity_type, related_entity_id
    ) VALUES (
      NULL, p_user_id, 'usage', -p_minutes,
      'استهلاك وقت مشاهدة',
      v_current_minutes, v_new_minutes,
      'video_course', p_course_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'remaining_minutes', v_new_minutes
    );

  ELSIF v_current_balance >= p_minutes THEN

    UPDATE user_credits
    SET
      balance = balance - p_minutes,
      total_spent = total_spent + p_minutes,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

    -- ADDED LOGGING HERE <--
    INSERT INTO credit_transactions (
      user_id, custom_user_id, transaction_type, amount,
      description, balance_before, balance_after,
      related_entity_type, related_entity_id
    ) VALUES (
      NULL, p_user_id, 'usage', -p_minutes,
      'استهلاك وقت مشاهدة من الرصيد العام',
      v_current_balance, v_current_balance - p_minutes,
      'video_course', p_course_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'remaining_balance', v_current_balance - p_minutes
    );

  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'رصيد غير كافي'
    );
  END IF;
END;
$$;

-- 2. Update consume_article_credit to return remaining credits/balance
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
  v_already_has_access boolean;
  v_new_credits integer;
  v_new_balance integer;
BEGIN

  SELECT EXISTS(
    SELECT 1 FROM article_access WHERE user_id = p_user_id AND article_id = p_article_id
  ) INTO v_already_has_access;
  
  IF v_already_has_access THEN
    RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
  END IF;

  SELECT
    article_credits,
    balance
  INTO
    v_current_credits,
    v_current_balance
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  v_new_credits := v_current_credits;
  v_new_balance := v_current_balance;

  IF v_current_credits >= 1 THEN

    v_new_credits := v_current_credits - 1;
    UPDATE user_credits
    SET
      article_credits = v_new_credits,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    v_new_balance := v_current_balance - 1;
    UPDATE user_credits
    SET
      balance = v_new_balance,
      total_spent = total_spent + 1,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

  ELSE

    RETURN jsonb_build_object(
      'success', false,
      'message', 'رصيد غير كافي'
    );

  END IF;

  INSERT INTO article_access (user_id, article_id)
  VALUES (p_user_id, p_article_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم فتح المقال بنجاح',
    'remaining_credits', v_new_credits,
    'remaining_balance', v_new_balance
  );

END;
$$;

-- 3. Update consume_research_credit to return remaining credits/balance
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
  v_new_credits integer;
  v_new_balance integer;
BEGIN

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

  v_new_credits := v_current_credits;
  v_new_balance := v_current_balance;

  IF v_current_credits >= 1 THEN

    v_new_credits := v_current_credits - 1;
    UPDATE user_credits
    SET
      research_credits = v_new_credits,
      updated_at = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    v_new_balance := v_current_balance - 1;
    UPDATE user_credits
    SET
      balance = v_new_balance,
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
    'message', 'تم فتح البحث بنجاح',
    'remaining_credits', v_new_credits,
    'remaining_balance', v_new_balance
  );

END;
$$;
