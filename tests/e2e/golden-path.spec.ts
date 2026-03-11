import { test, expect } from '@playwright/test';

test.describe('Golden Path', () => {
  test('full user journey: create -> commit -> verify', async ({ page }) => {
    // 1. Go to home page and verify auth
    await page.goto('/');
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible();

    // 2. Navigate to create forecast
    await page.getByRole('link', { name: /create/i }).first().click();
    await expect(page.getByRole('heading', { name: /create forecast/i })).toBeVisible();

    // 3. Fill in forecast details (Manual flow)
    const claimText = `E2E Test Forecast ${Date.now()}`;
    await page.getByPlaceholder(/what is the prediction/i).fill(claimText);
    
    // Set a future date (e.g., next year)
    await page.locator('input[type="datetime-local"]').fill('2027-01-01T12:00');
    
    // Submit
    await page.getByRole('button', { name: /publish forecast/i }).click();

    // 4. Verify redirection to the new forecast page
    await expect(page).toHaveURL(/\/forecasts\//);
    await expect(page.getByRole('heading', { name: claimText })).toBeVisible();

    // 5. Make a commitment
    // Check initial balance (expecting 1000 from auth.setup.ts)
    await expect(page.locator('text=/1000.*CU/i')).toBeVisible();

    // Fill commitment form
    await page.getByLabel(/amount to commit/i).fill('50');
    await page.getByRole('button', { name: /yes/i }).click();
    await page.getByRole('button', { name: /confirm commitment/i }).click();

    // 6. Verify commitment success
    await expect(page.getByText(/commitment successful/i)).toBeVisible();
    
    // Verify balance updated (1000 - 50 = 950)
    await expect(page.locator('text=/950.*CU/i')).toBeVisible();

    // 7. Verify it appears in "My Commitments"
    await page.goto('/commitments');
    await expect(page.getByText(claimText)).toBeVisible();
    await expect(page.getByText('50 CU')).toBeVisible();
  });
});
