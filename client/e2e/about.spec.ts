import { test, expect } from '@playwright/test';

test.describe('About Page', () => {
    test('should render about page content', async ({ page }) => {
        await page.goto('/about');

        await expect(page.getByRole('heading', { name: 'من نحن', exact: true })).toBeVisible();

        // Check specific layout text
        await expect(page.getByText('نحو مجتمع طبي متكامل ومتميز')).toBeVisible();

        // Check points
        await expect(page.getByRole('heading', { name: 'نشر المعرفة' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'التميز المهني' })).toBeVisible();
    });
});
