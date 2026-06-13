import { test, expect } from './fixtures/test-data';
import { isE2EEnvReady } from './fixtures/seed';

// Force mocks for this component to run independent of DB state
const useMocks = true;

test.beforeEach(async ({ page, articles }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('request', req => console.log('REQ:', req.method(), req.url()));

    if (!useMocks) return;

    // Intercept all articles API calls
    await page.route('**/api/articles**', async (route) => {
        const reqUrl = route.request().url();

        // CORS headers required for local dev/proxy interception in some setups
        const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

        // 1. Tags
        if (reqUrl.includes('/tags')) {
            return route.fulfill({
                headers: corsHeaders,
                json: ['تقويم', 'زراعة'],
            });
        }

        // 2. Related
        if (reqUrl.includes('/related')) {
            return route.fulfill({
                headers: corsHeaders,
                json: [],
            });
        }

        // 3. List
        const parsedUrl = new URL(reqUrl);
        if (parsedUrl.searchParams.has('page') || parsedUrl.searchParams.has('limit') || parsedUrl.pathname.endsWith('/articles')) {
            const search = parsedUrl.searchParams.get('search') || '';
            const tag = parsedUrl.searchParams.get('tag') || '';

            // Start with all mocked articles, map them to look like clinical cases
            let filtered = articles.map(a => ({ ...a, article_type: 'clinical_case' }));

            // Apply search term
            if (search) {
                filtered = filtered.filter(a =>
                    a.title.includes(search) ||
                    a.excerpt.includes(search)
                );
            }

            // Apply tag filter
            if (tag) {
                filtered = filtered.filter(a => a.tags.includes(tag));
            }

            return route.fulfill({
                headers: corsHeaders,
                json: {
                    data: filtered,
                    pagination: { total: filtered.length, pages: 1, limit: 9, page: 1 },
                },
            });
        }

        // 4. Single item fetch (ID match)
        const id = parsedUrl.pathname.split('/').pop();
        const article = articles.find((a) => a.id === id);
        if (article) {
            return route.fulfill({
                headers: corsHeaders,
                json: {
                    ...article,
                    article_type: 'clinical_case',
                    content: '<p>محتوى الحالة السريرية.</p>',
                    has_access: true,
                    credits_required: 0,
                },
            });
        }

        return route.continue();
    });

    // Intercept billing/credits check
    await page.route('**/api/credits/check-article-access/**', async (route) => {
        return route.fulfill({
            headers: { 'Access-Control-Allow-Origin': '*' },
            json: { has_access: true, credits_required: 0 },
        });
    });
});

test.describe('Clinical Cases Workflows', () => {
    test('should render clinical cases, allow filtering, and navigate to details', async ({ page }) => {
        await page.goto('/clinical-cases');

        // 1. Check initial rendering
        const heading = page.getByRole('heading', { name: 'الحالات السريرية', exact: true });
        await expect(heading).toBeVisible();

        // Since mock has 2 items initially
        await expect(page.getByText('دليل تقويم الأسنان')).toBeVisible();
        await expect(page.getByText('زراعة الأسنان الحديثة')).toBeVisible();

        // 2. Test text search filtering
        const searchInput = page.getByPlaceholder('ابحث عن حالة سريرية...');
        await searchInput.fill('زراعة');

        await expect(page.getByText('زراعة الأسنان الحديثة')).toBeVisible();
        await expect(page.getByText('دليل تقويم الأسنان')).toBeHidden();

        // 3. Clear search filter
        await searchInput.fill('');
        await expect(page.getByText('دليل تقويم الأسنان')).toBeVisible();

        // 4. Test dropdown tag filter
        const tagSelect = page.locator('select');
        await tagSelect.selectOption('تقويم');

        await expect(page.getByText('دليل تقويم الأسنان')).toBeVisible();
        await expect(page.getByText('زراعة الأسنان الحديثة')).toBeHidden();

        // 5. Open item details
        await page.getByText('دليل تقويم الأسنان').first().click();

        // Verify it navigates to the detailed page
        await expect(page).toHaveURL(/.*\/articles\/a1/);
        await expect(page.getByTestId('article-detail-title')).toHaveText('دليل تقويم الأسنان');
    });

    test('should display empty state when search yields no results', async ({ page }) => {
        await page.goto('/clinical-cases');

        // Fill an unmatched string
        const searchInput = page.getByPlaceholder('ابحث عن حالة سريرية...');
        await searchInput.fill('notfoundstring123');

        // Verify empty state UI
        await expect(page.getByText('لا توجد حالات سريرية')).toBeVisible();

        // Click the reset button from the empty state
        const resetButton = page.getByRole('button', { name: 'عرض كل الحالات' });
        await expect(resetButton).toBeVisible();
        await resetButton.click();

        // Verify it's reset
        await expect(searchInput).toHaveValue('');
        await expect(page.getByText('لا توجد حالات سريرية')).toBeHidden();
        await expect(page.getByText('دليل تقويم الأسنان')).toBeVisible();
    });
});
