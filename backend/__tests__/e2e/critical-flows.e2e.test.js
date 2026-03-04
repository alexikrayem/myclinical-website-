import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(__dirname, '../../../.env.e2e'),
  path.resolve(__dirname, '../../.env.e2e'),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
const shouldSkip = missing.length > 0;
const describeFn = shouldSkip ? describe.skip : describe;

const supabaseUrl = process.env.SUPABASE_URL || 'https://test.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

let api;
if (!shouldSkip) {
  const { default: app } = await import('../../server.js');
  api = request(app);
}

const makePhoneNumber = () => {
  const suffix = Math.floor(10000000 + Math.random() * 89999999);
  return `09${suffix}`;
};

describeFn('E2E critical backend flows', () => {
  let userId;
  let userToken;
  let adminToken;
  let articleId;
  const licenseIds = [];

  beforeAll(async () => {
    const phone = makePhoneNumber();
    const password = 'Test1234';

    const registerRes = await api
      .post('/api/auth/register')
      .send({ phone_number: phone, password, display_name: 'مستخدم اختبار' })
      .expect(201);

    userId = registerRes.body.user.id;

    const loginRes = await api
      .post('/api/auth/login')
      .send({ phone_number: phone, password })
      .expect(200);

    userToken = loginRes.body.token;

    const adminLogin = await api
      .post('/api/admin/login')
      .send({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD })
      .expect(200);

    adminToken = adminLogin.body.session.access_token;
  });

  afterAll(async () => {
    if (articleId) {
      await supabase.from('articles').delete().eq('id', articleId);
    }

    if (licenseIds.length) {
      await supabase.from('license_codes').delete().in('id', licenseIds);
    }

    if (userId) {
      await supabase.from('article_access').delete().eq('user_id', userId);
      await supabase.from('course_access').delete().eq('custom_user_id', userId);
      await supabase.from('credit_transactions').delete().eq('custom_user_id', userId);
      await supabase.from('user_sessions').delete().eq('user_id', userId);
      await supabase.from('user_credits').delete().eq('custom_user_id', userId);
      await supabase.from('users').delete().eq('id', userId);
    }
  });

  it('authenticates a user', async () => {
    expect(userId).toBeTruthy();
    expect(userToken).toBeTruthy();
  });

  it('redeems credits for a user', async () => {
    const { data: license, error } = await supabase
      .from('license_codes')
      .insert({
        code: `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        credit_amount: 1,
        credit_type: 'article',
        article_count: 1,
        is_redeemed: false,
      })
      .select()
      .single();

    if (error) throw error;
    licenseIds.push(license.id);

    const res = await api
      .post('/api/credits/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: license.code })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('performs article CRUD as admin', async () => {
    expect(adminToken).toBeTruthy();

    const createRes = await api
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', `مقال اختبار ${Date.now()}`)
      .field('excerpt', 'ملخص اختباري للمقال')
      .field('content', '<p>محتوى اختباري</p>')
      .field('author', 'مدير الاختبار')
      .field('tags', JSON.stringify(['اختبار']))
      .field('cover_image_url', 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg')
      .field('credits_required', '1')
      .field('article_type', 'article')
      .expect(201);

    articleId = createRes.body.id;

    const updateRes = await api
      .put(`/api/admin/articles/${articleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'مقال اختبار محدث')
      .field('excerpt', 'ملخص محدث')
      .field('content', '<p>تحديث المحتوى</p>')
      .field('author', 'مدير الاختبار')
      .field('tags', JSON.stringify(['اختبار']))
      .field('cover_image_url', 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg')
      .field('credits_required', '1')
      .field('article_type', 'article')
      .expect(200);

    expect(updateRes.body.title).toBe('مقال اختبار محدث');

    await api
      .delete(`/api/admin/articles/${articleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
