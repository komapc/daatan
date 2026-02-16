import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-secret-32-chars-minimum-length!!',
      NEXTAUTH_URL: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '123456789-dummy.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret-min-10-chars',
      SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION || '1',
    },
  },
});
