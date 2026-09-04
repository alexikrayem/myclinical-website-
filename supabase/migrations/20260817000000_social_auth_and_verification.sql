-- ============================================================
-- Migration: Social Auth & Decoupled Verification
-- Date: 2026-08-17
-- Breaking change: phone+password auth replaced by Meta OAuth.
-- Existing phone_number / password_hash columns are made nullable
-- to preserve historical data (read-only) without constraint violations.
-- ============================================================

-- 1. Make legacy credential columns nullable (soft deprecation)
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Add social-login identity columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_provider text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_provider_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_profile_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_avatar_url text;

-- 3. Add specialty column (required for all new users at signup)
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty text;

-- 4. Add is_verified flag — the single source of truth gating content creation.
--    Replaces the coupled role='doctor' AND verification_status='approved' check.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 5. Unique constraint: one social account = one platform account
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_social_provider_unique;
ALTER TABLE users ADD CONSTRAINT users_social_provider_unique
    UNIQUE (social_provider, social_provider_id);

-- 6. Indexes for social identity lookups
CREATE INDEX IF NOT EXISTS users_social_provider_id_idx ON users(social_provider, social_provider_id);
CREATE INDEX IF NOT EXISTS users_is_verified_idx ON users(is_verified);

-- 7. Create the verification_submissions table (decoupled from user creation)
CREATE TABLE IF NOT EXISTS verification_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    personal_id_url text NOT NULL,
    medical_id_url text NOT NULL,
    practice_license_url text NOT NULL,
    full_name text NOT NULL,
    specialty text NOT NULL,
    notes text,
    status text NOT NULL DEFAULT 'pending',
    reviewed_by uuid,
    reviewed_at timestamptz,
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT verification_submissions_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS verif_submissions_user_id_idx ON verification_submissions(user_id);
CREATE INDEX IF NOT EXISTS verif_submissions_status_idx ON verification_submissions(status);

-- 8. Auto-update updated_at on verification_submissions
CREATE OR REPLACE FUNCTION update_verification_submission_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verification_submissions_updated_at_trigger ON verification_submissions;
CREATE TRIGGER verification_submissions_updated_at_trigger
    BEFORE UPDATE ON verification_submissions
    FOR EACH ROW EXECUTE FUNCTION update_verification_submission_updated_at();

-- 9. Private storage bucket for verification documents (10MB limit, images + PDF)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'verification-documents',
    'verification-documents',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 10. RLS for verification_submissions: users can insert and read their own rows.
--     All writes/reads by admin happen via service-role (bypasses RLS).
ALTER TABLE verification_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own submissions" ON verification_submissions;
CREATE POLICY "Users can insert own submissions" ON verification_submissions
    FOR INSERT TO authenticated WITH CHECK (false); -- Backend uses service role; anon insert disabled.

DROP POLICY IF EXISTS "Users can view own submissions" ON verification_submissions;
CREATE POLICY "Users can view own submissions" ON verification_submissions
    FOR SELECT USING (false); -- Backend proxies all reads via service role.
