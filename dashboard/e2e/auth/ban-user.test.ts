import { createUser, generateTestEmail, gotoAuthURL } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import test, { expect } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await gotoAuthURL(page);
});

test.afterAll(async () => {
  await page.close();
});

test('should be able to ban and unban a user', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();
  await page.getByRole('button', { name: /actions/i }).click();
  await page.getByRole('menuitem', { name: /ban user/i }).click();

  await expect(
    page.getByText(/user has been banned successfully./i),
  ).toBeVisible();
  await expect(page.locator('form').getByText(/^banned$/i)).toBeVisible();

  await page.getByRole('button', { name: /actions/i }).click();
  await page.getByRole('menuitem', { name: /unban user/i }).click();

  await expect(
    page.getByText(/user has been unbanned successfully./i),
  ).toBeVisible();
  await expect(page.locator('form').getByText(/^banned$/i)).not.toBeVisible();
});
