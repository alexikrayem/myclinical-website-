import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
    console.log('🔍 Starting Foreign Key Diagnosis...\n');

    // 1. Create a test ID
    const testId = '00000000-0000-0000-0000-000000000001'; // Dummy UUID
    const testPhone = '0900000000';

    console.log('--- TEST 1: Checking public.users Link ---');
    try {
        // Clean up previous test
        await supabase.from('users').delete().eq('phone_number', testPhone);

        // Insert into PUBLIC.users
        const { error: insertError } = await supabase.from('users').insert({
            id: testId,
            phone_number: testPhone,
            password_hash: 'hash',
            display_name: 'Diagnosis User'
        });

        if (insertError) throw insertError;
        console.log('✅ Inserted test user into public.users');

        // Try to insert session
        const { error: sessionError } = await supabase.from('user_sessions').insert({
            user_id: testId,
            token_hash: 'test',
            expires_at: new Date().toISOString()
        });

        if (sessionError) {
            console.log('❌ Failed to insert session linked to public.users');
            console.log('   Error:', sessionError.message);
            console.log('   Start Conclusion: The FK does NOT point to public.users');
        } else {
            console.log('✅ Successfully inserted session linked to public.users');
            console.log('   Conclusion: The FK points to public.users correctly.');
            // Clean up session
            await supabase.from('user_sessions').delete().eq('user_id', testId);
        }
    } catch (e) {
        console.error('Test 1 Error:', e.message);
    }

    // Clean up public user
    await supabase.from('users').delete().eq('id', testId);

    console.log('\n--- TEST 2: Checking auth.users Link ---');
    let authUserId;
    try {
        // Create user in AUTH.users
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: 'diagnosis@test.com',
            password: process.env.ADMIN_PASSWORD || 'password123',
            email_confirm: true
        });

        if (authError) throw authError;
        authUserId = authUser.user.id;
        console.log('✅ Created test user in auth.users:', authUserId);

        // Try to insert session using Auth User ID
        const { error: sessionError } = await supabase.from('user_sessions').insert({
            user_id: authUserId,
            token_hash: 'test',
            expires_at: new Date().toISOString()
        });

        if (sessionError) {
            console.log('❌ Failed to insert session linked to auth.users');
            console.log('   Error:', sessionError.message);
        } else {
            console.log('⚠️  SUCCESS: Inserted session linked to auth.users');
            console.log('   !!! DIAGNOSIS CONFIRMED !!!');
            console.log('   The table "user_sessions" is incorrectly referencing "auth.users".');
            console.log('   It SHOULD be referencing "public.users".');
            // Clean up session
            await supabase.from('user_sessions').delete().eq('user_id', authUserId);
        }
    } catch (e) {
        console.error('Test 2 Error:', e.message);
    }

    // Clean up auth user
    if (authUserId) await supabase.auth.admin.deleteUser(authUserId);
}

diagnose();