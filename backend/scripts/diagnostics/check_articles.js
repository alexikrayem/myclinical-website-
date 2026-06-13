import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkArticlesSchema() {
    const { data, error } = await supabase.from('articles').select('*').limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Articles table columns:', Object.keys(data[0]));
        console.log('Sample article:');
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log('No articles found, checking table structure directly is not possible via JS client');
    }
}

checkArticlesSchema();
