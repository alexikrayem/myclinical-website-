import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should render hero section and main navigation', async ({ page }) => {
    await page.goto('/');

    // Check main heading in hero section
    await expect(page.getByRole('heading', { level: 1 })).toContainText('المهني والعلمي');

    // Check featured articles section is visible
    await expect(page.getByRole('heading', { name: 'المقالات المميزة' })).toBeVisible();

    // Check Categories section is visible
    await expect(page.getByRole('heading', { name: /التخصصات/ })).toBeVisible();
  });

  test('should navigate to articles page when clicking all articles button', async ({ page }) => {
    await page.goto('/');

    const allArticlesBtn = page.getByRole('link', { name: 'عرض جميع المقالات' }).first();
    await expect(allArticlesBtn).toBeVisible();
    await allArticlesBtn.click();

    await expect(page).toHaveURL(/.*\/articles/);
    // Since we don't know the exact heading of articles page, just checking URL and a generic main container
    await expect(page.getByRole('main').or(page.locator('.container-modern')).first()).toBeVisible();
  });
});
