import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { createUser, generateTestEmail } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import test, { expect } from '@playwright/test';

test('should be able to ban and unban a user', async ({ page }) => {
  const authUrl = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/users`;
  await page.goto(authUrl);
  await page.waitForURL(authUrl, { waitUntil: 'networkidle' });

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
