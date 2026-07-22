-- 1. Create Private Storage Bucket for Syndicate Cards
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('syndicate-cards', 'syndicate-cards', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Add doctor and verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS syndicate_card_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS education text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years integer DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_address text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3. Add Check Constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'doctor'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verification_status_check;
ALTER TABLE users ADD CONSTRAINT users_verification_status_check CHECK (verification_status IN ('none', 'pending', 'approved', 'rejected'));

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_verification_status_idx ON users(verification_status);

-- 5. Link Authors to Users table
ALTER TABLE authors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS authors_user_id_uniq_idx ON authors(user_id) WHERE user_id IS NOT NULL;
