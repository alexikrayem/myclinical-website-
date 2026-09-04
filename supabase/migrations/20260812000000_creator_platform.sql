-- Creator submissions, moderation lifecycle, author profiles and unlisted sharing.
-- Existing public content deliberately remains approved/listed after this migration.

ALTER TABLE articles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'professional';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'listed';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_audience_check;
ALTER TABLE articles ADD CONSTRAINT articles_audience_check CHECK (audience IN ('professional', 'public'));
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_visibility_check;
ALTER TABLE articles ADD CONSTRAINT articles_visibility_check CHECK (visibility IN ('listed', 'unlisted'));
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_audience ON articles(audience);
CREATE INDEX IF NOT EXISTS idx_articles_visibility ON articles(visibility);
CREATE INDEX IF NOT EXISTS idx_articles_submitted_by ON articles(submitted_by);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_share_token ON articles(share_token) WHERE share_token IS NOT NULL;
UPDATE articles a SET author_id = au.id FROM authors au
  WHERE a.author_id IS NULL AND lower(a.author) = lower(au.name);

ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE video_courses DROP CONSTRAINT IF EXISTS video_courses_status_check;
ALTER TABLE video_courses ADD CONSTRAINT video_courses_status_check CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));
CREATE INDEX IF NOT EXISTS idx_video_courses_status ON video_courses(status);
CREATE INDEX IF NOT EXISTS idx_video_courses_submitted_by ON video_courses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_video_courses_author_id ON video_courses(author_id);

ALTER TABLE authors ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS is_profile_public boolean NOT NULL DEFAULT true;
ALTER TABLE authors DROP CONSTRAINT IF EXISTS authors_social_links_object_check;
ALTER TABLE authors ADD CONSTRAINT authors_social_links_object_check CHECK (jsonb_typeof(social_links) = 'object');
CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug) WHERE slug IS NOT NULL;
UPDATE authors SET slug = lower(regexp_replace(name, '[^\u0621-\u064Aa-z0-9]+', '-', 'g'))
  WHERE slug IS NULL;

-- The service-role backend owns preview, submission and moderation reads. The anon key
-- can only read approved listed articles if it is ever used directly.
DROP POLICY IF EXISTS "Anyone can read articles" ON articles;
CREATE POLICY "Public can read published listed articles" ON articles
  FOR SELECT TO PUBLIC USING (status = 'approved' AND visibility = 'listed');

-- Public course catalog must never include a pending/rejected creator submission.
CREATE OR REPLACE VIEW courses_public AS
  SELECT id, title, description, cover_image, publication_date, author, categories,
    is_featured, credits_required, rating, total_students, duration, level,
    billing_model, minute_cost, playback_provider, preview_source, preview_seconds, author_id,
    attention_required
  FROM video_courses WHERE status = 'approved';
GRANT SELECT ON courses_public TO anon, authenticated;
