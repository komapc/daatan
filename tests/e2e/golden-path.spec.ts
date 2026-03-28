import { test, expect } from '@playwright/test';

test.describe('Golden Path', () => {
  test('create forecast → commit → verify in commitments list', async ({ page }) => {
    // ── Step 1: News Anchor (optional — skip it) ──────────────────────────
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /news anchor/i })).toBeVisible();
    await page.getByRole('button', { name: /next/i }).click();

    // ── Step 2: Prediction claim ──────────────────────────────────────────
    const claimText = `E2E test forecast ${Date.now()}`;
    await page.getByPlaceholder(/bitcoin will reach/i).fill(claimText);
    await page.getByRole('button', { name: /next/i }).click();

    // ── Step 3: Outcome & deadline ────────────────────────────────────────
    // Binary is selected by default — just set deadline and resolution rules
    const nextYear = new Date().getFullYear() + 1;
    await page.locator('input[type="date"]').fill(`${nextYear}-06-30`);
    await page.getByPlaceholder(/how should this be resolved/i).fill(
      'Resolves YES if confirmed by at least two independent credible sources before the deadline.'
    );
    await page.getByRole('button', { name: /next/i }).click();

    // ── Step 4: Review & publish ──────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /review.*publish/i })).toBeVisible();
    await page.getByRole('button', { name: /publish prediction/i }).click();

    // ── Verify redirect to forecast detail page ───────────────────────────
    await expect(page).toHaveURL(/\/forecasts\//);
    await expect(page.getByRole('heading', { name: claimText })).toBeVisible();

    // ── Make a commitment ─────────────────────────────────────────────────
    await page.getByRole('button', { name: /will happen/i }).click();

    // After committing, the form shows the "✓ Voted" badge
    await expect(page.getByText(/voted/i)).toBeVisible();

    // ── Verify it appears in the commitments list ─────────────────────────
    await page.goto('/commitments');
    await expect(page.getByText(claimText)).toBeVisible();
  });
});
