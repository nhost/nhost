import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Tests that are safe to run in parallel. To opt a new test directory into
// parallel execution, add its pattern here. Everything else runs sequentially
// in the "main" project by default.
const PARALLELIZABLE_TESTS = [
  'auth/**/*.test.ts',
  'account/**/*.test.ts',
  'overview/**/*.test.ts',
  'run/**/*.test.ts',
];

export default defineConfig({
  testDir: './e2e',
  maxFailures: process.env.CI ? 3 : 1,
  timeout: 120 * 1000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: 'html',
  use: {
    actionTimeout: 15000,
    trace: 'retain-on-failure',
    baseURL: process.env.NHOST_TEST_DASHBOARD_URL,
    launchOptions: {
      slowMo: 250,
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: ['**/setup/*.setup.ts'],
    },
    {
      name: 'main',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [
        'onboarding.test.ts',
        'cli-local-dashboard.test.ts',
        ...PARALLELIZABLE_TESTS,
      ],
    },
    {
      name: 'main-parallelizable',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: PARALLELIZABLE_TESTS,
    },
    {
      name: 'local',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: '', // Local dashboard URL
      },
      testMatch: 'cli-local-dashboard.test.ts',
    },
    {
      name: 'onboarding',
      testMatch: 'onboarding.test.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
