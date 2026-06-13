
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAdmin() {
    console.log('Verifying admin user...');
    console.log('URL:', process.env.SUPABASE_URL);

    // 1. List all admins
    const { data: admins, error } = await supabase
        .from('admins')
        .select('*');

    if (error) {
        console.error('Error fetching admins:', error);
        return;
    }

    console.log('Admins found:', admins.length);
    console.table(admins);

    // 2. Try to find the specific user by email if possible (via auth admin)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error listing auth users:', authError);
    } else {
        const adminUser = users.find(u => u.email === 'admin@admin.com');
        if (adminUser) {
            console.log('Auth User ID found:', adminUser.id);
            const match = admins.find(a => a.id === adminUser.id);
            if (match) {
                console.log('SUCCESS: Auth User ID matches an Admin record.');
            } else {
                console.error('FAILURE: Auth User ID does NOT match any Admin record.');
            }
        } else {
            console.error('Auth User admin@admin.com NOT found.');
        }
    }
}

verifyAdmin();
