import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/integration-test-env.ts'],
    include: ['**/*.integration.test.ts'],
    hookTimeout: 60000, // DB setup can be slow
    testTimeout: 30000,
    env: {
      TZ: 'UTC',
      NODE_ENV: 'test',
      SKIP_ENV_VALIDATION: '1',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
