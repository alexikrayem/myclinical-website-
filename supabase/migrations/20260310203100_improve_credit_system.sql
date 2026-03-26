-- =====================================================
-- Improve Credit System: Remove Race Conditions
-- =====================================================

-- -----------------------------------------------------
-- 1) Re-add already_has_access check in consume_article_credit
-- -----------------------------------------------------
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
BEGIN

  -- Check if already has access before attempting to lock
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

  IF v_current_credits >= 1 THEN

    UPDATE user_credits
    SET
      article_credits = article_credits - 1,
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

  INSERT INTO article_access (user_id, article_id)
  VALUES (p_user_id, p_article_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم فتح المقال بنجاح'
  );

END;
$$;


-- -----------------------------------------------------
-- 2) Atomic course purchase RPC (fixes race conditions)
-- -----------------------------------------------------
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

  -- Ensure credit row exists
  INSERT INTO user_credits (custom_user_id, balance, total_earned, video_watch_minutes, article_credits)
  VALUES (p_user_id, 0, 0, 0, 0)
  ON CONFLICT (custom_user_id) DO NOTHING;

  -- Lock user credits row for safe update
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
    p_user_id, 
    'usage', 
    -v_course.credits_required, 
    'شراء كورس: ' || v_course.title,
    v_current_balance, 
    v_current_balance - v_course.credits_required, 
    'course_access', 
    p_course_id,
    CASE WHEN p_idempotency_key IS NOT NULL THEN jsonb_build_object('idempotency_key', p_idempotency_key) ELSE '{}'::jsonb END
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم شراء الكورس بنجاح');
END;
$$;
