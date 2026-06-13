import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test('should show validation error on invalid login', async ({ page }) => {
        await page.goto('/login');

        await page.getByTestId('login-phone').fill('0912345678');
        await page.getByTestId('login-password').fill('wrongpassword123');

        await page.getByTestId('login-submit').click();

        // Verify error message from API (or standard error)
        await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10000 });
    });

    test('should have a link to register', async ({ page }) => {
        await page.goto('/login');

        const registerLink = page.getByRole('link', { name: 'إنشاء حساب جديد' });
        await expect(registerLink).toBeVisible();

        await registerLink.click();
        await expect(page).toHaveURL(/.*\/register/);
    });
});
