-- =====================================================
-- Level 6 Database Schema Audit Fixes
-- =====================================================

-- -----------------------------------------------------
-- 1. Canonicalize custom_user_id on article_access and research_access
-- -----------------------------------------------------

-- Add the custom_user_id column if it doesn't exist
ALTER TABLE article_access 
  ADD COLUMN IF NOT EXISTS custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE research_access 
  ADD COLUMN IF NOT EXISTS custom_user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Relax the NOT NULL constraint on user_id as we transition to custom_user_id
ALTER TABLE article_access ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE research_access ALTER COLUMN user_id DROP NOT NULL;

-- Backfill custom_user_id from user_id if needed, assuming user_id was UUID pointing to users(id)
-- Note: Assuming some might already be migrated, we coalesce.
-- In this system, user_id might have been text or uuid, if it's identical to custom_user_id, then:
UPDATE article_access SET custom_user_id = user_id::uuid WHERE custom_user_id IS NULL AND user_id IS NOT NULL;
UPDATE research_access SET custom_user_id = user_id::uuid WHERE custom_user_id IS NULL AND user_id IS NOT NULL;

-- Temporarily avoid making custom_user_id NOT NULL if there are orphaned records,
-- but the goal is to have it canonical.

-- Add composite unique constraints to prevent race condition insertions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'article_access_custom_user_unique'
  ) THEN
    -- Ensure no existing duplicates before applying unique constraint
    IF NOT EXISTS (
      SELECT 1 FROM article_access
      WHERE custom_user_id IS NOT NULL
      GROUP BY custom_user_id, article_id
      HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE article_access
        ADD CONSTRAINT article_access_custom_user_unique UNIQUE (custom_user_id, article_id);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'research_access_custom_user_unique'
  ) THEN
    -- Ensure no existing duplicates before applying unique constraint
    IF NOT EXISTS (
      SELECT 1 FROM research_access
      WHERE custom_user_id IS NOT NULL
      GROUP BY custom_user_id, research_id
      HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE research_access
        ADD CONSTRAINT research_access_custom_user_unique UNIQUE (custom_user_id, research_id);
    END IF;
  END IF;
END $$;


-- -----------------------------------------------------
-- 2. Optimize Indexes for Idempotency Checks
-- -----------------------------------------------------

-- Create a targeted compound index on credit_transactions to optimize the idempotency existence checks
CREATE INDEX IF NOT EXISTS credit_tx_idempotency_idx 
  ON credit_transactions (custom_user_id, related_entity_type, related_entity_id);

-- Create a GIN index on the metadata column for fast lookups (like metadata->>'idempotency_key')
CREATE INDEX IF NOT EXISTS credit_tx_metadata_gin_idx 
  ON credit_transactions USING GIN (metadata jsonb_path_ops);


-- -----------------------------------------------------
-- 3. Refactor consume_article_credit to use custom_user_id
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
  v_new_credits integer;
  v_new_balance integer;
BEGIN

  -- MIGRATED: Use custom_user_id exclusively for access existence check
  SELECT EXISTS(
    SELECT 1 FROM article_access 
    WHERE custom_user_id = p_user_id AND article_id = p_article_id
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
      updated_at      = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    v_new_balance := v_current_balance - 1;
    UPDATE user_credits
    SET
      balance         = v_new_balance,
      total_spent     = total_spent + 1,
      updated_at      = now()
    WHERE custom_user_id = p_user_id;

  ELSE

    RETURN jsonb_build_object(
      'success', false,
      'message', 'رصيد غير كافي'
    );

  END IF;

  -- MIGRATED: Insert access using custom_user_id
  INSERT INTO article_access (custom_user_id, article_id)
  VALUES (p_user_id, p_article_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم فتح المقال بنجاح',
    'remaining_credits', coalesce(v_new_credits, 0),
    'remaining_balance', coalesce(v_new_balance, 0)
  );

END;
$$;


-- -----------------------------------------------------
-- 4. Refactor consume_research_credit to use custom_user_id
-- -----------------------------------------------------
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

  -- MIGRATED: Use custom_user_id exclusively for access existence check
  SELECT EXISTS(
    SELECT 1 FROM research_access 
    WHERE custom_user_id = p_user_id AND research_id = p_research_id
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
      updated_at       = now()
    WHERE custom_user_id = p_user_id;

  ELSIF v_current_balance >= 1 THEN

    v_new_balance := v_current_balance - 1;
    UPDATE user_credits
    SET
      balance         = v_new_balance,
      total_spent     = total_spent + 1,
      updated_at      = now()
    WHERE custom_user_id = p_user_id;

  ELSE

    RETURN jsonb_build_object(
      'success', false,
      'message', 'رصيد غير كافي'
    );

  END IF;

  -- MIGRATED: Insert access using custom_user_id
  INSERT INTO research_access (custom_user_id, research_id)
  VALUES (p_user_id, p_research_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم فتح البحث بنجاح',
    'remaining_credits', coalesce(v_new_credits, 0),
    'remaining_balance', coalesce(v_new_balance, 0)
  );

END;
$$;
