import {
  TEST_PROJECT_NAME,
  TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { createUser, openProject } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await page.goto('/');

  await openProject({
    page,
    projectName: TEST_PROJECT_NAME,
    workspaceSlug: TEST_WORKSPACE_SLUG,
    projectSlug: TEST_PROJECT_SLUG,
  });

  await page
    .getByRole('navigation', { name: /main navigation/i })
    .getByRole('link', { name: /auth/i })
    .click();

  await page.waitForURL(`/${TEST_WORKSPACE_SLUG}/${TEST_PROJECT_SLUG}/users`);
});

test.afterAll(async () => {
  await page.close();
});

test('should create a user', async () => {
  const email = faker.internet.email();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).toBeVisible();
});

test('should not be able to create a user with an existing email', async () => {
  const email = faker.internet.email();
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

test('should delete a user', async () => {
  const email = faker.internet.email();
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

test('should be able to ban and unban a user', async () => {
  const email = faker.internet.email();
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

test('should be able to verify the email of a user', async () => {
  const email = faker.internet.email();
  const password = faker.internet.password();

  await createUser({ page, email, password });

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();

  await expect(
    page.getByRole('checkbox', { name: /email verified/i }),
  ).not.toBeChecked();
  await page.getByRole('checkbox', { name: /email verified/i }).check();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText(/user settings have been updated successfully./i),
  ).toBeVisible();

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();

  await expect(
    page.getByRole('checkbox', { name: /email verified/i }),
  ).toBeChecked();
});
