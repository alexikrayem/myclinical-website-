import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testAuthors() {
    // Test service role access to authors
    const { data, error } = await supabase.from('authors').select('*').limit(1);
    console.log('Authors query:', { dataCount: data?.length, error });

    // Try a test insert (what AuthorForm would do)
    const testData = {
        name: 'Test Author',
        bio: 'Test bio',
        image: 'https://example.com/test.jpg',
        specialization: 'Test',
        experience_years: 1,
        education: 'Test',
        location: 'Test',
        is_active: true
    };

    const { data: insertData, error: insertError } = await supabase
        .from('authors')
        .insert([testData])
        .select();

    console.log('Insert test:', insertError ? 'FAILED: ' + insertError.message : 'SUCCESS');

    // Clean up if successful
    if (!insertError && insertData && insertData.length > 0) {
        await supabase.from('authors').delete().eq('id', insertData[0].id);
        console.log('Cleaned up test author');
    }
}

testAuthors();
