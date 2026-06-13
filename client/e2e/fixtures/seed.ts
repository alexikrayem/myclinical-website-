import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isE2EEnvReady = () => Boolean(supabaseUrl && serviceKey);

export const supabase = isE2EEnvReady()
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : {} as ReturnType<typeof createClient>;

export const createTestArticle = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const now = new Date().toISOString();
  const payload = {
    title: `مقال اختباري ${Date.now()}`,
    excerpt: 'ملخص تجريبي للمقال في بيئة الاختبار',
    content: '<p>محتوى اختباري للمقال.</p>',
    cover_image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg',
    author: 'اختبار',
    tags: ['اختبار'],
    is_featured: false,
    publication_date: now,
    credits_required: 1,
    article_type: 'article',
    ...overrides,
  };

  const { data, error } = await supabase
    .from('articles')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestResearch = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const payload = {
    title: `بحث اختباري ${Date.now()}`,
    abstract: 'ملخص بحثي تجريبي',
    authors: ['باحث اختبار'],
    journal: 'مجلة الاختبار',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    publication_date: new Date().toISOString(),
    ...overrides,
  };

  const { data, error } = await supabase
    .from('researches')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestCourse = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const payload = {
    title: `دورة اختبارية ${Date.now()}`,
    description: 'وصف دورة اختباري.',
    cover_image: 'https://images.pexels.com/photos/4145190/pexels-photo-4145190.jpeg',
    playback_source: 'https://example.com/video.mp4',
    playback_provider: 'mp4',
    billing_model: 'per_course',
    minute_cost: 1,
    author: 'محاضر اختبار',
    categories: ['طب الأسنان التجميلي'],
    credits_required: 2,
    duration: 600,
    publication_date: new Date().toISOString(),
    ...overrides,
  };

  const { data, error } = await supabase
    .from('video_courses')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createLicenseCode = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const payload = {
    code: `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    credit_amount: 1,
    credit_type: 'article',
    article_count: 1,
    is_redeemed: false,
    ...overrides,
  };

  const { data, error } = await supabase
    .from('license_codes')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const upsertUserCredits = async (userId: string, credits: { balance?: number; video_watch_minutes?: number; article_credits?: number }) => {
  const payload = {
    custom_user_id: userId,
    balance: credits.balance ?? 0,
    video_watch_minutes: credits.video_watch_minutes ?? 0,
    article_credits: credits.article_credits ?? 0,
    total_earned: 0,
    total_spent: 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_credits')
    .upsert(payload, { onConflict: 'custom_user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteUserData = async (userId: string) => {
  await supabase.from('article_access').delete().eq('user_id', userId);
  await supabase.from('course_access').delete().eq('custom_user_id', userId);
  await supabase.from('credit_transactions').delete().eq('custom_user_id', userId);
  await supabase.from('user_sessions').delete().eq('user_id', userId);
  await supabase.from('user_credits').delete().eq('custom_user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
};

export const getUserByPhone = async (phone: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone_number, display_name')
    .eq('phone_number', phone)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const deleteByIds = async (table: string, ids: string[]) => {
  if (!ids.length) return;
  await supabase.from(table).delete().in('id', ids);
};
