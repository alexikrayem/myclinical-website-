import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBuckets() {
    console.log('Checking Supabase storage buckets...');

    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('Error listing buckets:', error);
        return;
    }

    console.log('Existing buckets:', buckets.map(b => b.name));

    // Try to create 'images' bucket if it doesn't exist
    if (!buckets.find(b => b.name === 'images')) {
        console.log("Creating 'images' bucket...");
        const { data, error: createError } = await supabase.storage.createBucket('images', {
            public: true,
            fileSizeLimit: 5242880 // 5MB
        });

        if (createError) {
            console.error('Failed to create bucket:', createError);
        } else {
            console.log('Successfully created images bucket!');
        }
    } else {
        console.log('images bucket already exists');
    }
}

checkBuckets();
