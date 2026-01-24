-- Harden RLS for user_credits table

-- Emsure RLS is enabled (idempotent)
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- 1. Policy: Users can only read their own credits
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits"
  ON user_credits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid()::text = custom_user_id::text);
-- Note: custom_user_id is used for phone auth users, user_id for email auth (admins mostly or legacy)
-- The schema uses custom_user_id for the main app users.

-- 2. Policy: Users CANNOT insert/update/delete their own credits
-- By default, if no policy exists for INSERT/UPDATE/DELETE, access is denied.
-- But explicitly dropping any permissive policies if they exist is good practice.
DROP POLICY IF EXISTS "Users can insert own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;
DROP POLICY IF EXISTS "Users can delete own credits" ON user_credits;

-- 3. Policy: Admins can do everything
DROP POLICY IF EXISTS "Admins can manage credits" ON user_credits;
CREATE POLICY "Admins can manage credits"
  ON user_credits
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );
