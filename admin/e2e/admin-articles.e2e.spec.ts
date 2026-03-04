import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ArticleFormPage } from './pages/ArticleFormPage';
import { createAuthor, createCategory, deleteByIds, getArticleByTitle, getAuthorByName, isE2EEnvReady } from './fixtures/seed';

const adminEmail = process.env.E2E_ADMIN_EMAIL || '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || '';

const canRun = isE2EEnvReady() && adminEmail && adminPassword;

test.describe('Admin article create/edit flow (real backend)', () => {
  test.skip(!canRun, 'E2E environment or admin credentials are missing');

  let categoryId = '';
  let categoryLabel = '';
  let authorName = '';

  test.beforeAll(async () => {
    const category = await createCategory({
      name_ar: `تصنيف اختباري ${Date.now()}`,
    });
    categoryId = category.id;
    categoryLabel = category.name_ar || category.name;

    const author = await createAuthor({
      name: `كاتب اختباري ${Date.now()}`,
    });
    authorName = author.name;
  });

  test.afterAll(async () => {
    await deleteByIds('categories', categoryId ? [categoryId] : []);
    const author = await getAuthorByName(authorName);
    if (author?.id) await deleteByIds('authors', [author.id]);
  });

  test('create and edit article', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(adminEmail, adminPassword);
    await expect(page).toHaveURL(/\/$/);

    const title = `مقال اختباري ${Date.now()}`;
    const updatedTitle = `${title} (محدث)`;

    await page.goto('/articles/create');

    const form = new ArticleFormPage(page);
    await form.fillBasicInfo(title, 'ملخص للاختبار');
    await form.selectAuthor(authorName);
    await form.fillContent('محتوى اختباري');
    await form.useCoverImageUrl('https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg');
    await form.selectCategory(categoryLabel);
    await form.setCredits('1');
    await form.submit();

    await expect(page).toHaveURL(/\/articles$/);

    const created = await getArticleByTitle(title);
    if (!created?.id) throw new Error('Failed to locate created article');

    await page.getByTestId(`admin-article-edit-${created.id}`).click();
    await expect(page).toHaveURL(/\/articles\/edit\//);

    await form.titleInput.fill(updatedTitle);
    await form.submit();

    await expect(page).toHaveURL(/\/articles$/);
    await expect(page.getByText(updatedTitle)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(`admin-article-delete-${created.id}`).click();

    await deleteByIds('articles', [created.id]);
  });
});
