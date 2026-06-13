import { test, expect } from '@playwright/test';

test.describe('Not Found Page', () => {
    test('should show 404 error for invalid URL', async ({ page }) => {
        const randomUrl = `/does-not-exist-${Date.now()}`;
        await page.goto(randomUrl);

        // Should display 404
        await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible();

        // Test link to go back home
        await page.getByRole('link', { name: 'العودة إلى الصفحة الرئيسية' }).click();

        // Should be on home page (ignoring purely host or basic paths)
        await expect(page).toHaveURL(/.*(:\d+)?\/$/);
        await expect(page.getByRole('heading', { name: /ارتقِ بمستقبلك/ })).toBeVisible();
    });
});
