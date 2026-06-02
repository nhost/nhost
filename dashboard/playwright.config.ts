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
  'serverless-functions/**/*.test.ts',
];

export default defineConfig({
  testDir: './e2e',
  maxFailures: process.env.CI ? 3 : 1,
  timeout: 120 * 1000,
  expect: {
    // Higher than the default to absorb cold Vercel-preview / staging latency
    // on web-first assertions, matching the raised actionTimeout below.
    timeout: 15000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: 'html',
  use: {
    actionTimeout: 30000,
    trace: 'retain-on-failure',
    baseURL: process.env.NHOST_TEST_DASHBOARD_URL,
    launchOptions: {
      // slowMo is a debugging aid only; it adds latency to every action, so
      // disable it in CI where it just slows the suite down.
      slowMo: process.env.CI ? 0 : 100,
    },
  },
  projects: [
    {
      name: 'setup-auth',
      testMatch: ['**/setup/auth.setup.ts'],
    },
    {
      name: 'setup',
      testMatch: [
        '**/setup/database.setup.ts',
        '**/setup/refresh-metadata.setup.ts',
      ],
      dependencies: ['setup-auth'],
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
