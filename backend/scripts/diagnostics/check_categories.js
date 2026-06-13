import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCategories() {
    const { data, error } = await supabase.from('categories').select('*').limit(5);
    console.log('Categories table structure:');
    console.log('Sample data:', data);
    console.log('Error:', error);

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    }
}
checkCategories();
