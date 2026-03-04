import { test, expect } from './fixtures/test-data';
import { LoginPage } from './pages/LoginPage';
import { ArticlesPage } from './pages/ArticlesPage';

const useMocks = process.env.E2E_USE_MOCKS === '1';

test.describe('Admin critical flows (mocked)', () => {
  test.skip(!useMocks, 'E2E_USE_MOCKS is disabled');

  test.beforeEach(async ({ page, adminUser, articles }) => {
    await page.route('**/api/admin/login', (route) =>
      route.fulfill({
        json: {
          user: { id: '1', email: adminUser.email, role: 'admin' },
          session: { access_token: 'test-token' },
        },
      })
    );

    await page.route('**/api/admin/profile', (route) =>
      route.fulfill({
        json: { id: '1', email: 'admin@arabdental.com', role: 'admin' },
      })
    );

    await page.route('**/api/articles', (route) =>
      route.fulfill({
        json: { data: articles },
      })
    );

    await page.route('**/api/research', (route) =>
      route.fulfill({
        json: { data: [] },
      })
    );

    await page.route('**/api/authors', (route) =>
      route.fulfill({
        json: [],
      })
    );
  });

  test('admin can log in and see dashboard stats', async ({ page, adminUser }) => {
    const loginPage = new LoginPage(page);

    await test.step('Login as admin', async () => {
      await loginPage.goto();
      await loginPage.login(adminUser.email, adminUser.password);
    });

    await test.step('Dashboard loads', async () => {
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'مرحباً بك في لوحة التحكم' })).toBeVisible();
      await expect(page.getByText('إجمالي المقالات')).toBeVisible();
    });
  });

  test('admin can filter articles list', async ({ page, articles, adminUser }) => {
    const loginPage = new LoginPage(page);
    const articlesPage = new ArticlesPage(page);

    await test.step('Login as admin', async () => {
      await loginPage.goto();
      await loginPage.login(adminUser.email, adminUser.password);
      await expect(page).toHaveURL(/\/$/);
    });

    await test.step('Navigate to articles and filter', async () => {
      await articlesPage.gotoFromSidebar();
      await expect(page).toHaveURL(/\/articles$/);

      await articlesPage.search('زراعة');
      await expect(articlesPage.articleRowTitle(articles[1].title)).toBeVisible();
      await expect(articlesPage.articleRowTitle(articles[0].title)).toHaveCount(0);
    });
  });
});
