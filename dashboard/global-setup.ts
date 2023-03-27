import { chromium } from '@playwright/test';
import {
  TEST_DASHBOARD_URL,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
} from './e2e/env';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(TEST_DASHBOARD_URL);
  await page.waitForURL(`${TEST_DASHBOARD_URL}/signin`);
  await page.getByRole('link', { name: /continue with email/i }).click();

  await page.waitForURL(`${TEST_DASHBOARD_URL}/signin/email`);
  await page.getByLabel('Email').fill(TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(TEST_DASHBOARD_URL);
  await page.context().storageState({ path: 'storageState.json' });

  await browser.close();
}

export default globalSetup;
