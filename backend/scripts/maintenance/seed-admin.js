import 'dotenv/config';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const ADMIN_ROLE = 'admin'

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables')
    process.exit(1)
}

async function seedAdmin() {
    // 1️⃣ Look for existing user
    const { data: usersData, error: listError } =
        await supabase.auth.admin.listUsers({
            email: ADMIN_EMAIL,
            perPage: 1
        })

    if (listError) {
        console.error('Failed to list users:', listError.message)
        process.exit(1)
    }

    let userId

    if (usersData.users.length === 0) {
        // 2️⃣ Create auth user
        const { data, error } =
            await supabase.auth.admin.createUser({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                email_confirm: true,
                app_metadata: { role: ADMIN_ROLE }
            })

        if (error) {
            console.error('Failed to create admin user:', error.message)
            process.exit(1)
        }

        userId = data.user.id
        console.log('Admin auth user created')
    } else {
        userId = usersData.users[0].id
        console.log('Admin auth user already exists')
    }

    // 3️⃣ Upsert into admins table
    const { error: adminError } = await supabase
        .from('admins')
        .upsert({
            id: userId,
            email: ADMIN_EMAIL,
            role: ADMIN_ROLE
        })

    if (adminError) {
        console.error('Failed to upsert admin:', adminError.message)
        process.exit(1)
    }

    console.log('✅ Admin seeded successfully')
}

seedAdmin()
