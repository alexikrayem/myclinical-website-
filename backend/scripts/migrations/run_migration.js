import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom fetch with longer timeout
const customFetch = (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    return fetch(url, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
};

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        global: {
            fetch: customFetch
        },
        auth: {
            persistSession: false
        }
    }
);

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMigrationWithRetry(retries = 3) {
    console.log('🚀 Starting migration check for "research-pdfs" bucket...');

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`\n🔄 Attempt ${attempt}/${retries}...`);
            }

            console.log('Attempting to access/create bucket via Storage API...');

            // Try to get the bucket first to see if it exists
            const { data: buckets, error: listError } = await supabase
                .storage
                .listBuckets();

            if (listError) {
                throw listError;
            }

            const bucketExists = buckets.find(b => b.name === 'research-pdfs');

            if (bucketExists) {
                console.log('✅ Bucket "research-pdfs" already exists.');
            } else {
                console.log('Bucket does not exist. Creating...');
                const { data: bucket, error: createError } = await supabase
                    .storage
                    .createBucket('research-pdfs', {
                        public: false,
                        allowedMimeTypes: ['application/pdf'],
                        fileSizeLimit: 10485760 // 10MB
                    });

                if (createError) {
                    throw createError;
                }
                console.log('✅ Bucket "research-pdfs" created successfully.');
            }

            console.log('\n🎉 Migration Check Completed Successfully!');
            return; // Success

        } catch (error) {
            console.error(`❌ Error on attempt ${attempt}:`, error.message);
            if (error.cause) console.error('   Cause:', error.cause);

            if (attempt === retries) {
                console.error('\n💥 All attempts failed.');
                console.error('Please verify your internet connection or try running the following SQL manually in the Supabase Dashboard:');
                console.error(`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('research-pdfs', 'research-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
        `);
            } else {
                const delay = 2000 * attempt;
                console.log(`Waiting ${delay}ms before retrying...`);
                await wait(delay);
            }
        }
    }
}

runMigrationWithRetry();
