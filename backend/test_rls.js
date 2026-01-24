import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testServiceRole() {
    console.log('Testing service role access to admins table...');

    // Service role should bypass RLS
    const { data, error } = await supabase.from('admins').select('*');
    console.log('Service role result:', { dataCount: data?.length, error });

    if (error) {
        console.error('ERROR: Service role is NOT bypassing RLS!');
        console.error('This means the backend supabase client might be misconfigured.');
    } else {
        console.log('SUCCESS: Service role correctly bypasses RLS.');
        console.log('The backend should work. Let me check if auth.uid() based lookup works...');

        // Now test as an authenticated user
        const { data: authData } = await supabase.auth.signInWithPassword({
            email: 'admin@admin.com',
            password: 'theeasyhard123'
        });

        if (authData?.session) {
            // Create a new client with the user's access token
            const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: 'Bearer ' + authData.session.access_token } }
            });

            const { data: adminData, error: adminError } = await userClient
                .from('admins')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            console.log('User token query result:', { adminData, adminError });

            if (adminError?.message?.includes('infinite recursion')) {
                console.error('CONFIRMED: The RLS policy has infinite recursion.');
                console.log('You need to run the migration fix in Supabase Dashboard SQL Editor.');
            }
        }
    }
}

testServiceRole();
