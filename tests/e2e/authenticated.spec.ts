import { test, expect } from '@playwright/test';

test.describe('authenticated flows', () => {
  test('user can access profile', async ({ page }) => {
    await page.goto('/');
    // Check if we have a sidebar with user's name/username
    // Based on src/components/Sidebar.tsx
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible();
  });

  test('user can navigate to create forecast', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /create forecast/i })).toBeVisible();
    await expect(page.getByPlaceholder(/what is the prediction/i)).toBeVisible();
  });

  test('user can see notifications', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
  });

  test('user can see their commitments', async ({ page }) => {
    await page.goto('/commitments');
    await expect(page.getByRole('heading', { name: /my commitments/i })).toBeVisible();
  });
});
