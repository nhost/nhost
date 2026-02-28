import { test as setup } from '@playwright/test';
import {
  TEST_DASHBOARD_URL,
  TEST_PERSONAL_ORG_SLUG,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
} from '@/e2e/env';

setup('authenticate user', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('/signin');
  await page.getByRole('link', { name: /continue with email/i }).click();

  await page.waitForURL('/signin/email');
  await page.getByLabel('Email').fill(TEST_USER_EMAIL);
  await page.getByLabel('Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(
    `${TEST_DASHBOARD_URL}/orgs/${TEST_PERSONAL_ORG_SLUG}/projects`,
    { waitUntil: 'load' },
  );
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
