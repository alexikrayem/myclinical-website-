import { test, expect, request } from '@playwright/test';
import {
  createTestCourse,
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

test.describe('Courses flow (real backend)', () => {
  test.skip(!isE2EEnvReady(), 'E2E environment is not configured');

  test('user can purchase course access', async ({ page }) => {
    const course = await createTestCourse({
      title: 'دورة اختبارية للشراء',
      credits_required: 2,
    });

    const phone = makePhoneNumber();
    const api = await request.newContext({ baseURL: apiBase });

    const registerResponse = await api.post('/api/auth/register', {
      data: {
        phone_number: phone,
        password: defaultPassword,
        display_name: 'مستخدم دورة',
      },
    });

    expect(registerResponse.ok()).toBeTruthy();

    const user = await getUserByPhone(phone);
    if (!user?.id) throw new Error('Failed to locate test user');

    await upsertUserCredits(user.id, { balance: 5 });

    await page.goto('/login');
    await page.getByTestId('login-phone').fill(phone);
    await page.getByTestId('login-password').fill(defaultPassword);
    await page.getByTestId('login-submit').click();

    await page.goto(`/courses/${course.id}`);
    await expect(page.getByTestId('course-detail-title')).toHaveText('دورة اختبارية للشراء');
    await expect(page.getByTestId('course-purchase-button')).toBeVisible();

    await page.getByTestId('course-purchase-button').click();
    await expect(page.getByTestId('course-access-granted')).toBeVisible();

    await deleteByIds('video_courses', [course.id]);
    await deleteUserData(user.id);
  });
});
