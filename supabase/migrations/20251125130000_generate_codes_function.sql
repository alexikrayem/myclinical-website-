-- Function to generate random codes
CREATE OR REPLACE FUNCTION generate_license_codes(
    amount_of_codes INTEGER,
    credit_value INTEGER,
    prefix TEXT DEFAULT 'GIFT'
) RETURNS TABLE (code TEXT) AS $$
DECLARE
    i INTEGER;
    new_code TEXT;
BEGIN
    FOR i IN 1..amount_of_codes LOOP
        -- Generate a random string (e.g., GIFT-A1B2-C3D4)
        new_code := prefix || '-' || upper(substring(md5(random()::text) from 1 for 4)) || '-' || upper(substring(md5(random()::text) from 5 for 4));
        
        -- Insert into table
        INSERT INTO license_codes (code, credit_amount)
        VALUES (new_code, credit_value);
        
        -- Return the generated code
        code := new_code;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Example Usage:
-- Generate 10 codes worth 100 credits each
-- SELECT * FROM generate_license_codes(10, 100, 'SUMMER');
