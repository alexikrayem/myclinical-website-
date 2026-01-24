-- Updated function to generate random codes with support for different credit types
CREATE OR REPLACE FUNCTION generate_license_codes_v2(
    p_amount INTEGER,
    p_credit_value INTEGER,
    p_prefix TEXT DEFAULT 'GIFT',
    p_credit_type TEXT DEFAULT 'universal',
    p_video_minutes INTEGER DEFAULT 0,
    p_article_count INTEGER DEFAULT 0
) RETURNS TABLE (code TEXT) AS $$
DECLARE
    v_i INTEGER;
    v_new_code TEXT;
BEGIN
    FOR v_i IN 1..p_amount LOOP
        -- Generate a random string (e.g., GIFT-A1B2-C3D4)
        v_new_code := p_prefix || '-' || upper(substring(md5(random()::text) from 1 for 4)) || '-' || upper(substring(md5(random()::text) from 5 for 4));
        
        -- Insert into table with new fields
        INSERT INTO license_codes (
            code, 
            credit_amount, 
            credit_type, 
            video_minutes, 
            article_count,
            created_at
        )
        VALUES (
            v_new_code, 
            p_credit_value, 
            p_credit_type, 
            p_video_minutes, 
            p_article_count,
            now()
        );
        
        -- Return the generated code
        code := v_new_code;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
