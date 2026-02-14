import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const CARBONYL_PATH = path.resolve(__dirname, 'bin/carbonyl-0.0.3/carbonyl');

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        // This is the key part: using Carbonyl as the browser executable
        launchOptions: {
            executablePath: CARBONYL_PATH,
        }
    },
    projects: [
        {
            name: 'carbonyl',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // We can start the dev server before running tests
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        env: {
            NEXTAUTH_URL: 'http://localhost:3000',
        },
    },
});
