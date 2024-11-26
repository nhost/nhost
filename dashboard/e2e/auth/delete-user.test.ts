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

test('should be able to delete a user', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: `More options for ${email}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: /delete user/i }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /delete user/i }),
  ).toBeVisible();
  await expect(
    page.getByText(`Are you sure you want to delete the "${email}" user?`),
  ).toBeVisible();

  await page.getByRole('button', { name: /delete/i, exact: true }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible();

  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).not.toBeVisible();
});

test('should be able to delete a user from the details page', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();

  await page.getByRole('button', { name: /actions/i }).click();
  await page.getByRole('menuitem', { name: /delete user/i }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /delete user/i }),
  ).toBeVisible();
  await expect(
    page.getByText(`Are you sure you want to delete the "${email}" user?`),
  ).toBeVisible();

  await page.getByRole('button', { name: /delete/i, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).not.toBeVisible();
});
