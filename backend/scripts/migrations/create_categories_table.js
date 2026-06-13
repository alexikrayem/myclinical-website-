import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createCategoriesTable() {
    console.log('Creating categories table...');

    // Use raw SQL via RPC or just insert directly - Supabase doesn't have raw SQL in JS client
    // Instead, let me check if we can use the SQL endpoint or just seed data

    // Actually, we need to run migration via Supabase CLI or Dashboard
    // Let me just output the SQL for the user to run

    const sql = `
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    name_ar VARCHAR(100),
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read active categories
CREATE POLICY "Anyone can view categories" ON categories
    FOR SELECT TO PUBLIC USING (true);
`;

    console.log('Please run this SQL in your Supabase Dashboard -> SQL Editor:');
    console.log(sql);
}

createCategoriesTable();
