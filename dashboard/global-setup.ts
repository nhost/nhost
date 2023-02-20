import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://staging.app.nhost.io/');
  await page.waitForURL('https://staging.app.nhost.io/signin');
  await page.getByRole('link', { name: /continue with email/i }).click();

  await page.waitForURL('https://staging.app.nhost.io/signin/email');
  await page.getByLabel('Email').fill(process.env.NHOST_TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(process.env.NHOST_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL('https://staging.app.nhost.io/');
  await page.context().storageState({ path: 'storageState.json' });

  await browser.close();
}

export default globalSetup;
