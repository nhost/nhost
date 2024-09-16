import {
  PRO_TEST_PROJECT_NAME,
  PRO_TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { createUser, generateTestEmail, openProject } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import test, { expect } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await page.goto('/');

  await openProject({
    page,
    projectName: PRO_TEST_PROJECT_NAME,
    workspaceSlug: TEST_WORKSPACE_SLUG,
    projectSlug: PRO_TEST_PROJECT_SLUG,
  });

  await page
    .getByRole('navigation', { name: /main navigation/i })
    .getByRole('link', { name: /auth/i })
    .click();

  await page.waitForURL(
    `/${TEST_WORKSPACE_SLUG}/${PRO_TEST_PROJECT_SLUG}/users`,
  );
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
