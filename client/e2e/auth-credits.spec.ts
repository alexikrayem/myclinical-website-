import { test, expect, request } from '@playwright/test';
import {
  createLicenseCode,
  createTestArticle,
  deleteByIds,
  deleteUserData,
  getUserByPhone,
  isE2EEnvReady,
  upsertUserCredits,
} from './fixtures/seed';

const apiBase = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://127.0.0.1:5001';
const defaultPassword = 'Test1234';

const makePhoneNumber = () => {
  const suffix = Math.floor(10000000 + Math.random() * 89999999);
  return `09${suffix}`;
};

test.describe('Auth and credits flows (real backend)', () => {
  test.skip(!isE2EEnvReady(), 'E2E environment is not configured');

  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    for (const userId of createdUserIds) {
      await deleteUserData(userId);
    }
  });

  test('user can register and open user menu', async ({ page }) => {
    const phone = makePhoneNumber();

    await page.goto('/register');
    await page.getByTestId('register-display-name').fill('مستخدم اختبار');
    await page.getByTestId('register-phone').fill(phone);
    await page.getByTestId('register-password').fill(defaultPassword);
    await page.getByTestId('register-confirm-password').fill(defaultPassword);
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('user-menu-button')).toBeVisible();
    await page.getByTestId('user-menu-button').click();
    await expect(page.getByTestId('user-menu-phone')).toHaveText(phone);

    const user = await getUserByPhone(phone);
    if (user?.id) createdUserIds.push(user.id);
  });

  test('user can redeem credits and unlock an article', async ({ page }) => {
    const phone = makePhoneNumber();
    const api = await request.newContext({ baseURL: apiBase });

    const registerResponse = await api.post('/api/auth/register', {
      data: {
        phone_number: phone,
        password: defaultPassword,
        display_name: 'مستخدم رصيد',
      },
    });

    expect(registerResponse.ok()).toBeTruthy();

    const user = await getUserByPhone(phone);
    if (!user?.id) throw new Error('Failed to locate test user');
    createdUserIds.push(user.id);

    const article = await createTestArticle({
      title: 'مقال يتطلب رصيداً',
      credits_required: 1,
      tags: ['اختبار'],
    });

    const license = await createLicenseCode({
      credit_type: 'article',
      article_count: 1,
      credit_amount: 1,
    });

    await upsertUserCredits(user.id, { balance: 0, article_credits: 0 });

    await page.goto('/login');
    await page.getByTestId('login-phone').fill(phone);
    await page.getByTestId('login-password').fill(defaultPassword);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('user-menu-button')).toBeVisible();
    await page.getByTestId('user-menu-button').click();
    await page.getByTestId('user-menu-redeem').click();

    await expect(page.getByTestId('credits-modal')).toBeVisible();
    await page.getByTestId('credits-code-input').fill(license.code);
    await page.getByTestId('credits-submit').click();

    await expect(page.getByTestId('credits-result')).toContainText('تم شحن الرصيد');

    await page.goto(`/articles/${article.id}`);
    await expect(page.getByTestId('article-lock-card')).toBeVisible();
    await page.getByTestId('article-unlock-button').click();

    await expect(page.getByTestId('article-full-content')).toBeVisible();

    await deleteByIds('license_codes', [license.id]);
    await deleteByIds('articles', [article.id]);
  });
});
