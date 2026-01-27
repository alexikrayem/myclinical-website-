-- Enable pg_trgm extension for trigram-based similarity search (better for Arabic)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a text search configuration for Arabic (if not exists)
-- Note: Postgres doesn't have built-in Arabic stemmer, so we use 'simple' with trigrams
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic_simple') THEN
        CREATE TEXT SEARCH CONFIGURATION arabic_simple (COPY = simple);
    END IF;
END $$;

-- Add a generated tsvector column for full-text search
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION articles_search_vector_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.excerpt, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(regexp_replace(NEW.content, '<[^>]*>', '', 'g'), '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search vector
DROP TRIGGER IF EXISTS articles_search_vector_update ON articles;
CREATE TRIGGER articles_search_vector_update
    BEFORE INSERT OR UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION articles_search_vector_trigger();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_articles_search_vector ON articles USING GIN(search_vector);

-- Create trigram indexes for LIKE/similarity searches (backup for Arabic)
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_excerpt_trgm ON articles USING GIN(excerpt gin_trgm_ops);

-- Update existing articles to populate search_vector
UPDATE articles SET search_vector = 
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(regexp_replace(content, '<[^>]*>', '', 'g'), '')), 'C');
