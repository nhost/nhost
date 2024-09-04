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
