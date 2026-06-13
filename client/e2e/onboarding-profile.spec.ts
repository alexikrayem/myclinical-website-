import { test, expect } from '@playwright/test';

// Force mocks to bypass missing Supabase keys locally
const useMocks = true;

test.beforeEach(async ({ page }) => {
    if (!useMocks) return;

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    // Mock auth registration
    await page.route('**/auth/register', async (route) => {
        return route.fulfill({
            headers: corsHeaders,
            json: {
                user: { id: 'user-id-123', phone_number: '0911223344', display_name: 'طبيب أسنان مختبر' },
                token: 'dummy-token',
                isComplete: false // forces onboarding flow
            }
        });
    });

    // Mock navbar or common data missing in onboarding that might be requested globally
    await page.route('**/research/journals/list', async (route) => {
        return route.fulfill({ headers: corsHeaders, json: { data: [] } });
    });

    await page.route('**/articles/tags', async (route) => {
        return route.fulfill({ headers: corsHeaders, json: [] });
    });

    // Mock profile fetch and update
    await page.route('**/profile**', async (route) => {
        const req = route.request();

        if (req.method() === 'OPTIONS') {
            return route.fulfill({ headers: corsHeaders, status: 200 });
        }

        if (req.method() === 'GET') {
            return route.fulfill({
                headers: corsHeaders,
                json: {
                    user: {
                        id: '123',
                        display_name: 'طبيب أسنان مختبر',
                        phone_number: '0911223344',
                        role: 'dentist',
                        specialty: null,
                        experience_years: null,
                        bio: null,
                    },
                    credits: null
                }
            });
        }

        if (req.method() === 'PUT') {
            // Simulate successful save
            return route.fulfill({
                headers: corsHeaders,
                json: {
                    user: {
                        id: '123',
                        display_name: 'طبيب أسنان مختبر',
                        specialty: 'تقويم الأسنان (Orthodontics)',
                        experience_years: 5,
                        bio: 'طبيب أسنان متخصص',
                        isComplete: true
                    }
                }
            });
        }

        return route.continue();
    });
});

test.describe('Onboarding & Profile Workflows (Mocked)', () => {
    test('end-to-end signup, profile updates, and logout', async ({ page }) => {

        // 1. Visit signup and register
        await page.goto('/register');

        // We add console tracing to be 100% sure the payload hits our mock if it fails
        page.on('console', msg => console.log(msg.text()));

        await page.getByTestId('register-display-name').fill('طبيب أسنان مختبر');
        await page.getByTestId('register-phone').fill('0911223344');
        await page.getByTestId('register-password').fill('Test1234');
        await page.getByTestId('register-confirm-password').fill('Test1234');

        // Register action triggers our mock
        await page.getByTestId('register-submit').click();

        // 2. Verify redirect to root and navigate to Profile
        await expect(page).toHaveURL('http://127.0.0.1:5173/');

        // The user menu should be visible now that we are authenticated
        await expect(page.getByTestId('user-menu-button')).toBeVisible({ timeout: 15000 });
        await page.getByTestId('user-menu-button').click();
        await page.getByText(/الملف الشخصي|حسابي/).first().click();

        // Now wait until URL stabilizes on profile
        await expect(page).toHaveURL(/.*\/profile/);

        // 3. Edit profile details
        // Ensure initial display name matches what's returned from the GET mock
        await expect(page.getByText('طبيب أسنان مختبر', { exact: true })).toBeVisible();

        // Click Edit
        await page.getByRole('button', { name: 'تعديل' }).click();

        // Wait for the input to become visible after clicking edit
        const displayNameInput = page.getByRole('textbox').last();
        await expect(displayNameInput).toBeVisible();

        // Enter new display name
        await displayNameInput.fill('طبيب أسنان معدل');

        // Save profile changes (triggers PUT mock)
        await page.getByRole('button', { name: 'حفظ', exact: true }).click();

        // Expect success message
        await expect(page.getByText('تم تحديث الملف الشخصي')).toBeVisible({ timeout: 10000 });

        // 4. Test Logout Flow
        await page.getByTestId('user-menu-button').click();
        await page.getByTestId('user-menu-logout').click();

        // Expect auth state cleanup to bounce back to login
        await expect(page).toHaveURL(/.*\/login/);
    });
});
