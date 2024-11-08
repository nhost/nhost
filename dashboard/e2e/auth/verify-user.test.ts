import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { createUser, generateTestEmail } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

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
