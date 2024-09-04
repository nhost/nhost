import {
  PRO_TEST_PROJECT_NAME,
  PRO_TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { createUser, generateTestEmail, openProject } from '@/e2e/utils';
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

test('should be able to verify the email of a user', async () => {
  const email = generateTestEmail();
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

test('should be able to verify the phone number of a user', async () => {
  const email = generateTestEmail();
  const password = faker.internet.password();
  const phoneNumber = faker.phone.number();

  await createUser({ page, email, password });

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();

  await expect(
    page.getByRole('checkbox', { name: /phone number verified/i }),
  ).toBeDisabled();

  await page.getByRole('textbox', { name: /phone number/i }).fill(phoneNumber);
  await page.getByRole('checkbox', { name: /phone number verified/i }).check();
  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText(/user settings have been updated successfully./i),
  ).toBeVisible();

  await page
    .getByRole('button', { name: `View ${email}`, exact: true })
    .click();

  await expect(
    page.getByRole('textbox', { name: /phone number/i }),
  ).toHaveValue(phoneNumber);

  await expect(
    page.getByRole('checkbox', { name: /phone number verified/i }),
  ).toBeChecked();
});
