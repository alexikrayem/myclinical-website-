import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const baseOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabasePublic = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    ...baseOptions,
    global: { headers: { 'X-Client-Info': 'backend-public' } }
  }
);

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    ...baseOptions,
    global: { headers: { 'X-Client-Info': 'backend-admin' } }
  }
);
