import { chromium } from '@playwright/test';

const testUrl = process.env.NHOST_TEST_URL;

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(testUrl);
  await page.waitForURL(`${testUrl}/signin`);
  await page.getByRole('link', { name: /continue with email/i }).click();

  await page.waitForURL(`${testUrl}/signin/email`);
  await page.getByLabel('Email').fill(process.env.NHOST_TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(process.env.NHOST_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(testUrl);
  await page.context().storageState({ path: 'storageState.json' });

  await browser.close();
}

export default globalSetup;
