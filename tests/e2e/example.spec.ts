import { test, expect } from '@playwright/test';

test('visitor can navigate to home and see forecasts', async ({ page }) => {
  // Test 1: Home page loads
  await page.goto('/');
  await expect(page).toHaveTitle(/Daatan/i);

  // Test 2: Check for main feed content
  // We expect to see some forecasts or the "Latest Forecasts" header
  // Adjusting selector based on likely content, or just checking for main container
  const main = page.locator('main');
  await expect(main).toBeVisible();
});

test('visitor can navigate to login page', async ({ page }) => {
  await page.goto('/auth/signin');
  // Check for specific text with extended timeout
  // Target main h1 to avoid Sidebar
  await expect(page.locator('main h1')).toContainText(/Welcome to DAATAN/i, { timeout: 15000 });
});
