-- =====================================================
-- Fix license code redemption for phone-auth users
-- Safe + concurrency protected migration
-- =====================================================

-- -----------------------------------------------------
-- 1) Track custom user redemption separately
-- -----------------------------------------------------

ALTER TABLE license_codes
ADD COLUMN IF NOT EXISTS custom_redeemed_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'license_codes_custom_redeemed_by_fkey'
  ) THEN
    ALTER TABLE license_codes
    ADD CONSTRAINT license_codes_custom_redeemed_by_fkey
    FOREIGN KEY (custom_redeemed_by) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS license_codes_custom_redeemed_by_idx
ON license_codes(custom_redeemed_by);

-- -----------------------------------------------------
-- 2) SAFE license redemption function
-- Prevents double redemption + race conditions
-- -----------------------------------------------------

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

  v_new_balance integer;
  v_new_video_minutes integer;
  v_new_article_credits integer;
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
    article_credits
  )
  VALUES (p_user_id,0,0,0,0)
  ON CONFLICT (custom_user_id) DO NOTHING;

  -- Lock credit row
  SELECT
    balance,
    video_watch_minutes,
    article_credits
  INTO
    v_current_balance,
    v_current_video_minutes,
    v_current_article_credits
  FROM user_credits
  WHERE custom_user_id = p_user_id
  FOR UPDATE;

  v_new_balance := v_current_balance;
  v_new_video_minutes := v_current_video_minutes;
  v_new_article_credits := v_current_article_credits;

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
      v_license_record.article_count
    ),
    'شحن رصيد عبر كود',
    v_current_balance,
    v_new_balance,
    'license_code',
    v_license_record.id,
    jsonb_build_object(
      'credit_type', v_license_record.credit_type,
      'video_minutes_added',
      v_new_video_minutes - v_current_video_minutes,
      'article_credits_added',
      v_new_article_credits - v_current_article_credits
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
$$;

-- -----------------------------------------------------
-- 3) Consume video minutes
-- -----------------------------------------------------

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
      user_id,
      custom_user_id,
      transaction_type,
      amount,
      description,
      balance_before,
      balance_after,
      related_entity_type,
      related_entity_id
    )
    VALUES (
      NULL,
      p_user_id,
      'usage',
      -p_minutes,
      'استهلاك وقت مشاهدة',
      v_current_minutes,
      v_new_minutes,
      'video_course',
      p_course_id
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

-- -----------------------------------------------------
-- 4) Consume article credit
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
BEGIN

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
    'success', true
  );

END;
$$;

-- -----------------------------------------------------
-- 5) Fix admin report view (TYPE SAFE)
-- -----------------------------------------------------

DROP VIEW IF EXISTS admin_license_quiz_report;

CREATE VIEW admin_license_quiz_report AS
SELECT
  lc.code,
  lc.credit_amount,
  lc.redeemed_at,
  COALESCE(au.email, pu.phone_number)::varchar(255) AS user_email,
  vc.title AS course_title,
  uqa.score,
  uqa.passed,
  uqa.attempted_at
FROM license_codes lc
LEFT JOIN auth.users au
  ON lc.redeemed_by = au.id
LEFT JOIN public.users pu
  ON lc.custom_redeemed_by = pu.id
LEFT JOIN user_quiz_attempts uqa
  ON (
    (lc.custom_redeemed_by IS NOT NULL AND uqa.custom_user_id = lc.custom_redeemed_by)
    OR
    (lc.custom_redeemed_by IS NULL AND uqa.user_id = lc.redeemed_by)
  )
LEFT JOIN quizzes q
  ON uqa.quiz_id = q.id
LEFT JOIN video_courses vc
  ON q.course_id = vc.id
WHERE lc.is_redeemed = true
ORDER BY lc.redeemed_at DESC;

GRANT SELECT ON admin_license_quiz_report TO authenticated;