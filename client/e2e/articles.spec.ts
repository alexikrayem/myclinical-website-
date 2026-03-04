import { test, expect } from './fixtures/test-data';
import { isE2EEnvReady } from './fixtures/seed';
import { ArticlesPage } from './pages/ArticlesPage';

const useMocks = process.env.E2E_USE_MOCKS === '1' || !isE2EEnvReady();

test.beforeEach(async ({ page, articles }) => {
  if (!useMocks) {
    return;
  }

  await page.route('**/api/articles**', (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/api/articles')) {
      const search = url.searchParams.get('search');
      const tag = url.searchParams.get('tag');

      let filtered = [...articles];
      if (search) {
        filtered = filtered.filter(
          (article) =>
            article.title.includes(search) ||
            article.excerpt.includes(search) ||
            article.author.includes(search)
        );
      }
      if (tag) {
        filtered = filtered.filter((article) => article.tags.includes(tag));
      }

      return route.fulfill({
        json: {
          data: filtered,
          pagination: { total: filtered.length },
        },
      });
    }

    if (url.pathname.endsWith('/related')) {
      return route.fulfill({ json: [] });
    }

    const id = url.pathname.split('/').pop();
    const article = articles.find((item) => item.id === id) ?? articles[0];

    return route.fulfill({
      json: {
        ...article,
        content: '<p>محتوى تجريبي للمقال.</p>',
        has_access: true,
        credits_required: 0,
      },
    });
  });

  await page.route('**/api/credits/check-article-access/**', (route) => {
    return route.fulfill({
      json: { has_access: true, credits_required: 0 },
    });
  });
});

test('browse articles, filter, and open detail', async ({ page, articles }) => {
  const articlesPage = new ArticlesPage(page);

  await test.step('Open articles list', async () => {
    await articlesPage.goto();
    await expect(articlesPage.articleTitle(articles[0].title)).toBeVisible();
    await expect(articlesPage.articleTitle(articles[1].title)).toBeVisible();
  });

  await test.step('Filter by search term', async () => {
    await articlesPage.search('زراعة');
    await expect(articlesPage.articleTitle(articles[1].title)).toBeVisible();
    await expect(articlesPage.articleTitle(articles[0].title)).toHaveCount(0);
  });

  await test.step('Clear filters', async () => {
    await articlesPage.clearSearch();
    await expect(articlesPage.articleTitle(articles[0].title)).toBeVisible();
  });

  await test.step('Filter by tag and open article', async () => {
    await articlesPage.toggleFilters();
    await articlesPage.selectTag('تقويم');
    await expect(page.getByText('الموضوع: تقويم')).toBeVisible();
    await expect(articlesPage.articleTitle(articles[0].title)).toBeVisible();
    await expect(articlesPage.articleTitle(articles[1].title)).toHaveCount(0);

    await articlesPage.articleTitle(articles[0].title).click();
    await expect(page).toHaveURL(new RegExp(`/articles/${articles[0].id}$`));
    await expect(page.getByTestId('article-detail-title')).toHaveText(articles[0].title);
  });
});
