import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: '', // Local dashboard URL
    launchOptions: {
      slowMo: 500,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  testMatch: ['**/e2e/cli-local-dashboard/**'],
});
