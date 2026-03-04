import { test, expect } from '@playwright/test';
import { createTestResearch, deleteByIds, isE2EEnvReady } from './fixtures/seed';

test.describe('Research flows (real backend)', () => {
  test.skip(!isE2EEnvReady(), 'E2E environment is not configured');

  test('search research and open detail', async ({ page }) => {
    const research = await createTestResearch({
      title: 'بحث تجريبي في طب الأسنان',
      journal: 'مجلة الاختبار',
    });

    await page.goto('/research-topics');
    await page.getByTestId('research-search-input').fill('بحث تجريبي');

    await expect(page.getByTestId(`research-card-${research.id}`)).toBeVisible();
    await expect(page.getByTestId(`research-card-title-${research.id}`)).toHaveText('بحث تجريبي في طب الأسنان');

    await page.goto(`/research/${research.id}`);
    await expect(page.getByTestId('research-detail-title')).toHaveText('بحث تجريبي في طب الأسنان');

    await page.getByTestId('research-view-full').click();
    await expect(page.getByTestId('research-pdf-login-required')).toBeVisible();

    await deleteByIds('researches', [research.id]);
  });
});
