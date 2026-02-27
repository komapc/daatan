import { test, expect } from '@playwright/test'

/**
 * Smoke tests — verify public pages load without crashing.
 * These run against a live dev/staging server and do not require auth.
 */

test('home page loads', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBeLessThan(500)
  // Should redirect to sign-in or show the feed
  await expect(page).toHaveURL(/\/(auth\/signin|$)/)
})

test('sign-in page renders the Google button', async ({ page }) => {
  await page.goto('/auth/signin')
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
})

test('sign-in page shows title', async ({ page }) => {
  await page.goto('/auth/signin')
  await expect(page.getByRole('heading', { name: /welcome to daatan/i })).toBeVisible()
})

test('unknown route returns a not-found response (no 500)', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist-xyz')
  expect(response?.status()).not.toBe(500)
})

test('health API responds 200', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body).toHaveProperty('status')
})
