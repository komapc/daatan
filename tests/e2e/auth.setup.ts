import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // We'll use the Credentials provider we added.
  // In NextAuth 4, the default sign-in path with credentials is POST /api/auth/callback/credentials
  // But it's easier to just use the UI if we have a form, or just use request.
  
  // Since we don't have a UI form for credentials (it's hidden/test-only), 
  // we can use the API directly to sign in.
  
  await page.goto('/auth/signin');
  
  // We can inject a script or just use request to set the session cookie.
  // Actually, let's just use the Credentials login page if NextAuth provides it.
  // By default, it's at /api/auth/signin
  
  await page.goto('/api/auth/signin');
  await page.getByLabel('User ID').fill('test-user-1');
  await page.getByRole('button', { name: 'Sign in with Playwright Test' }).click();

  await expect(page).toHaveURL('/');
  
  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});
