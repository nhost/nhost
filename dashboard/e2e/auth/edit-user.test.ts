import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { createUser, generateTestEmail } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import test, { expect } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  const authUrl = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/users`;
  await page.goto(authUrl);
  await page.waitForURL(authUrl, { waitUntil: 'networkidle' });
});

test.afterAll(async () => {
  await page.close();
});

test('should be able to edit user roles from the details page', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();

  await page.locator('#defaultRole').click();
  await page.getByRole('option', { name: /anonymous/i }).click();

  await page.getByLabel('anonymous').click();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText('User settings have been updated successfully.'),
  ).toBeVisible();
});
