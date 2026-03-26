-- =====================================================
-- Secure License Code Generation Upgrade
-- =====================================================

-- Upgrade the license code generator to use CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
-- and increase the entropy by extending the code length.

CREATE OR REPLACE FUNCTION generate_license_codes_v2(
    p_amount INTEGER,
    p_credit_value INTEGER,
    p_prefix TEXT DEFAULT 'GIFT',
    p_credit_type TEXT DEFAULT 'universal',
    p_video_minutes INTEGER DEFAULT 0,
    p_article_count INTEGER DEFAULT 0,
    p_research_count INTEGER DEFAULT 0
) RETURNS TABLE (code TEXT) AS $$
DECLARE
    v_i INTEGER;
    v_new_code TEXT;
    v_random_hex TEXT;
BEGIN
    FOR v_i IN 1..p_amount LOOP
        -- Using gen_random_bytes(6) for true cryptographic randomness.
        -- 6 bytes = 12 hex characters.
        -- Formats as PREFIX-XXXX-XXXX-XXXX
        v_random_hex := upper(encode(gen_random_bytes(6), 'hex'));
        
        v_new_code := p_prefix || '-' || 
                     substring(v_random_hex from 1 for 4) || '-' || 
                     substring(v_random_hex from 5 for 4) || '-' || 
                     substring(v_random_hex from 9 for 4);
        
        -- Insert into table
        INSERT INTO license_codes (
            code, 
            credit_amount, 
            credit_type, 
            video_minutes, 
            article_count,
            research_count,
            created_at
        )
        VALUES (
            v_new_code, 
            p_credit_value, 
            p_credit_type, 
            p_video_minutes, 
            p_article_count,
            p_research_count,
            now()
        );
        
        -- Return the generated code
        code := v_new_code;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
