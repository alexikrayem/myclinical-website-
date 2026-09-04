-- Remove repeated catalog scans and the per-HLS-request course lookup.

ALTER TABLE course_playback_sessions
  ADD COLUMN IF NOT EXISTS playback_source text;

-- A session is a short-lived capability. Snapshot the source used to issue it
-- so each authenticated HLS manifest/segment request only reads that session.
UPDATE course_playback_sessions session
SET playback_source = course.playback_source
FROM video_courses course
WHERE session.course_id = course.id
  AND session.playback_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_articles_tags_gin ON articles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_video_courses_categories_gin ON video_courses USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_articles_publication_date ON articles (publication_date DESC);

CREATE OR REPLACE FUNCTION public.get_public_article_tags()
RETURNS TABLE(tag text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT value AS tag
  FROM articles
  CROSS JOIN LATERAL unnest(COALESCE(tags, '{}'::text[])) AS value
  WHERE status = 'approved'
    AND visibility = 'listed';
$$;

CREATE OR REPLACE FUNCTION public.get_public_course_categories()
RETURNS TABLE(category text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT btrim(value) AS category
  FROM courses_public
  CROSS JOIN LATERAL unnest(COALESCE(categories, '{}'::text[])) AS value
  WHERE btrim(value) <> '';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_article_tags() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_course_categories() TO anon, authenticated, service_role;
