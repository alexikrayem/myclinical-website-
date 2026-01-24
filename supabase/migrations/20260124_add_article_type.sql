-- Add article_type column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_type text DEFAULT 'article';

-- Add check constraint to ensure valid types
ALTER TABLE articles ADD CONSTRAINT articles_article_type_check CHECK (article_type IN ('article', 'clinical_case'));

-- Index on article_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_articles_article_type ON articles(article_type);
