import {
  PRO_TEST_PROJECT_NAME,
  PRO_TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { createUser, generateTestEmail, openProject } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import test, { expect } from '@playwright/test';

test('should be able to ban and unban a user', async ({ page }) => {
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
