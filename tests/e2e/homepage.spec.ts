import { test, expect } from '@playwright/test';

test('homepage has expected title and basic UI elements', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Daatan/i);

    // Expect the main feed element or some known text to be present
    // Since FeedClient fetches client-side, we wait for a common element
    // Based on code, we can check for "Latest Forecasts" or a navigation item
    await expect(page.locator('text=Daatan').first()).toBeVisible();
});
