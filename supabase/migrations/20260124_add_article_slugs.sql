-- Add slug column to articles table for SEO-friendly URLs
ALTER TABLE articles ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create function to generate slug from title
CREATE OR REPLACE FUNCTION generate_article_slug(title text)
RETURNS text AS $$
DECLARE
    base_slug text;
    final_slug text;
    counter integer := 1;
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special chars
    base_slug := lower(regexp_replace(title, '[^\u0621-\u064A\u0660-\u0669a-z0-9\s-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    
    -- If empty, use timestamp
    IF base_slug = '' OR base_slug IS NULL THEN
        base_slug := 'article-' || extract(epoch from now())::text;
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness and append number if needed
    WHILE EXISTS (SELECT 1 FROM articles WHERE slug = final_slug) LOOP
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

-- Generate slugs for existing articles that don't have one
UPDATE articles SET slug = generate_article_slug(title) WHERE slug IS NULL;
