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

test('should create a user', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).toBeVisible();
});

test('should not be able to create a user with an existing email', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).toBeVisible();

  await createUser({ page, email, password });

  await expect(
    page.getByRole('dialog').getByText(/email already in use/i),
  ).toBeVisible();
});
