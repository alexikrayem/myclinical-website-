/*
  # Add Full Text Search and Trigram Support

  1. Extensions
    - Enable pg_trgm for trigram similarity search
    - Enable unaccent for better text search

  2. Search Functions
    - Create FTS search function for articles
    - Create FTS search function for research papers
    - Add trigram indexes for better search performance

  3. Indexes
    - Add GIN indexes for full text search
    - Add trigram indexes for similarity search
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add text search columns to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add text search columns to researches
ALTER TABLE researches ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vectors for articles
CREATE OR REPLACE FUNCTION update_articles_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('arabic', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.author, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update search vectors for researches
CREATE OR REPLACE FUNCTION update_researches_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('arabic', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.abstract, '')), 'B') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.journal, '')), 'C') ||
    setweight(to_tsvector('arabic', COALESCE(array_to_string(NEW.authors, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update search vectors
DROP TRIGGER IF EXISTS articles_search_vector_trigger ON articles;
CREATE TRIGGER articles_search_vector_trigger
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_articles_search_vector();

DROP TRIGGER IF EXISTS researches_search_vector_trigger ON researches;
CREATE TRIGGER researches_search_vector_trigger
  BEFORE INSERT OR UPDATE ON researches
  FOR EACH ROW EXECUTE FUNCTION update_researches_search_vector();

-- Update existing records
UPDATE articles SET search_vector = 
  setweight(to_tsvector('arabic', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('arabic', COALESCE(excerpt, '')), 'B') ||
  setweight(to_tsvector('arabic', COALESCE(content, '')), 'C') ||
  setweight(to_tsvector('arabic', COALESCE(author, '')), 'D');

UPDATE researches SET search_vector = 
  setweight(to_tsvector('arabic', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('arabic', COALESCE(abstract, '')), 'B') ||
  setweight(to_tsvector('arabic', COALESCE(journal, '')), 'C') ||
  setweight(to_tsvector('arabic', COALESCE(array_to_string(authors, ' '), '')), 'D');

-- Create GIN indexes for full text search
CREATE INDEX IF NOT EXISTS articles_search_vector_idx ON articles USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS researches_search_vector_idx ON researches USING GIN(search_vector);

-- Create trigram indexes for similarity search
CREATE INDEX IF NOT EXISTS articles_title_trgm_idx ON articles USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS articles_content_trgm_idx ON articles USING GIN(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS researches_title_trgm_idx ON researches USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS researches_abstract_trgm_idx ON researches USING GIN(abstract gin_trgm_ops);

-- Create advanced search function for articles
CREATE OR REPLACE FUNCTION search_articles_fts(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  author TEXT,
  tags TEXT[],
  is_featured BOOLEAN,
  publication_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.excerpt,
    a.content,
    a.cover_image,
    a.author,
    a.tags,
    a.is_featured,
    a.publication_date,
    a.created_at,
    a.updated_at,
    ts_rank(a.search_vector, plainto_tsquery('arabic', search_query)) as rank
  FROM articles a
  WHERE a.search_vector @@ plainto_tsquery('arabic', search_query)
     OR similarity(a.title, search_query) > 0.3
     OR similarity(a.content, search_query) > 0.1
  ORDER BY 
    ts_rank(a.search_vector, plainto_tsquery('arabic', search_query)) DESC,
    similarity(a.title, search_query) DESC,
    a.publication_date DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- Create advanced search function for research papers
CREATE OR REPLACE FUNCTION search_research_fts(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  abstract TEXT,
  authors TEXT[],
  journal TEXT,
  file_url TEXT,
  publication_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.abstract,
    r.authors,
    r.journal,
    r.file_url,
    r.publication_date,
    r.created_at,
    r.updated_at,
    ts_rank(r.search_vector, plainto_tsquery('arabic', search_query)) as rank
  FROM researches r
  WHERE r.search_vector @@ plainto_tsquery('arabic', search_query)
     OR similarity(r.title, search_query) > 0.3
     OR similarity(r.abstract, search_query) > 0.1
  ORDER BY 
    ts_rank(r.search_vector, plainto_tsquery('arabic', search_query)) DESC,
    similarity(r.title, search_query) DESC,
    r.publication_date DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;