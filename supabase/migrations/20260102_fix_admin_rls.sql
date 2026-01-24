-- Fix infinite recursion in admins table RLS policy
-- The old policy checked if user exists in admins table, which caused recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can read all admin data" ON admins;
DROP POLICY IF EXISTS "Admins can read own data" ON admins;

-- Create a simple policy that allows authenticated users to read their own admin record
-- This doesn't cause recursion because it only checks auth.uid() = id
CREATE POLICY "Admins can read own data"
  ON admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- For service role operations (like the backend server), RLS is bypassed anyway
-- So we don't need a policy for "all admin data" from the server side
