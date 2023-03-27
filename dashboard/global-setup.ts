import {
  TEST_DASHBOARD_URL,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
} from '@/e2e/env';
import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: TEST_DASHBOARD_URL });

  await page.goto('/');
  await page.waitForURL('/signin');
  await page.getByRole('link', { name: /continue with email/i }).click();

  await page.waitForURL('/signin/email');
  await page.getByLabel('Email').fill(TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(TEST_DASHBOARD_URL);
  await page.context().storageState({ path: 'storageState.json' });

  await browser.close();
}

export default globalSetup;
