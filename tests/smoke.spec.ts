import { test, expect } from '@playwright/test';

// Basic smoke to ensure home and dashboard render without crashing.
test.describe('Smoke', () => {
  test('home loads and has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CineCritique/i);
  });

  test('dashboard route loads', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Analytics Dashboard/i })).toBeVisible({ timeout: 10_000 });
  });
});
