/*
  # Fix Admin Setup and Authentication

  1. Admin User Creation
    - Create a proper admin user in auth.users
    - Link to admins table
    - Set proper email confirmation

  2. Security Fixes
    - Update RLS policies for better admin access
    - Add proper constraints
*/

-- First, let's create a proper admin user
-- Note: In production, you should create this through the Supabase dashboard or auth API

-- Insert admin user if not exists
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Check if admin user already exists
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@arabdental.com';
    
    IF admin_user_id IS NULL THEN
        -- Create admin user
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            invited_at,
            confirmation_token,
            confirmation_sent_at,
            recovery_token,
            recovery_sent_at,
            email_change_token_new,
            email_change,
            email_change_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            phone,
            phone_confirmed_at,
            phone_change,
            phone_change_token,
            phone_change_sent_at,
            email_change_token_current,
            email_change_confirm_status,
            banned_until,
            reauthentication_token,
            reauthentication_sent_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'admin@arabdental.com',
            '$2a$10$U6EwF8e58IrpDcEbYeY6..pChJdSu0EfZdZj5mF.Z7w/D0r2dn2FK', -- Password: Admin123!
            NOW(),
            NOW(),
            '',
            NOW(),
            '',
            NOW(),
            '',
            '',
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{}',
            FALSE,
            NOW(),
            NOW(),
            NULL,
            NULL,
            '',
            '',
            NOW(),
            '',
            0,
            NULL,
            '',
            NOW()
        ) RETURNING id INTO admin_user_id;
        
        -- Insert into admins table
        INSERT INTO admins (id, email, role)
        VALUES (admin_user_id, 'admin@arabdental.com', 'admin');
        
        RAISE NOTICE 'Admin user created with email: admin@arabdental.com and password: Admin123!';
    ELSE
        -- Ensure admin exists in admins table
        INSERT INTO admins (id, email, role)
        VALUES (admin_user_id, 'admin@arabdental.com', 'admin')
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Admin user already exists';
    END IF;
END $$;

-- Update admin policies to be more specific
DROP POLICY IF EXISTS "Admins can read own data" ON admins;
CREATE POLICY "Admins can read own data"
  ON admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Add policy for admins to read all admin data (for user management)
DROP POLICY IF EXISTS "Admins can read all admin data" ON admins;
CREATE POLICY "Admins can read all admin data"
  ON admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- Ensure articles policies work correctly
DROP POLICY IF EXISTS "Admins can insert articles" ON articles;
CREATE POLICY "Admins can insert articles"
  ON articles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update articles" ON articles;
CREATE POLICY "Admins can update articles"
  ON articles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can delete articles" ON articles;
CREATE POLICY "Admins can delete articles"
  ON articles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );