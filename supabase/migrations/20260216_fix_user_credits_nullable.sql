/*
  Fix: Make user_id nullable on user_credits table
  
  The user_credits table was originally created with user_id (referencing auth.users)
  as NOT NULL. Phone auth users don't exist in auth.users - they only exist in 
  public.users, referenced via custom_user_id. This migration makes user_id nullable
  so that phone auth users can have credit records with only custom_user_id set.
*/

-- Make user_id nullable (it was NOT NULL, referencing auth.users)
ALTER TABLE user_credits ALTER COLUMN user_id DROP NOT NULL;

-- Add a unique constraint on custom_user_id if not exists
-- (needed for ON CONFLICT in the redeem function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_credits_custom_user_id_key'
    AND table_name = 'user_credits'
  ) THEN
    ALTER TABLE user_credits ADD CONSTRAINT user_credits_custom_user_id_key UNIQUE (custom_user_id);
  END IF;
END $$;
