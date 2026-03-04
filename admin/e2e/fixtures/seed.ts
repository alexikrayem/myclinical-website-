import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isE2EEnvReady = () => Boolean(supabaseUrl && serviceKey);

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export const createCategory = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const payload = {
    name: `e2e-category-${Date.now()}`,
    name_ar: 'تصنيف اختباري',
    description: 'تصنيف للاختبارات',
    color: '#3B82F6',
    is_active: true,
    ...overrides,
  };

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createAuthor = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const payload = {
    name: `كاتب اختباري ${Date.now()}`,
    bio: 'سيرة ذاتية للاختبار',
    image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg',
    specialization: 'اختبار',
    experience_years: 5,
    education: 'جامعة الاختبار',
    location: 'الرياض',
    email: `e2e-${Date.now()}@example.com`,
    is_active: true,
    ...overrides,
  };

  const { data, error } = await supabase
    .from('authors')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteByIds = async (table: string, ids: string[]) => {
  if (!ids.length) return;
  await supabase.from(table).delete().in('id', ids);
};

export const getArticleByTitle = async (title: string) => {
  const { data, error } = await supabase
    .from('articles')
    .select('id, title')
    .eq('title', title)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getAuthorByName = async (name: string) => {
  const { data, error } = await supabase
    .from('authors')
    .select('id, name')
    .eq('name', name)
    .maybeSingle();

  if (error) throw error;
  return data;
};
