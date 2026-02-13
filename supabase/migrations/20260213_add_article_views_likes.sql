-- Add views, likes, and categories columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_articles_views ON articles(views DESC);
CREATE INDEX IF NOT EXISTS idx_articles_likes ON articles(likes DESC);
CREATE INDEX IF NOT EXISTS idx_articles_categories ON articles USING GIN(categories);
