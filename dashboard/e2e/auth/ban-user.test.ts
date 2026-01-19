import { faker } from '@faker-js/faker';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { createUser, generateTestEmail, gotoAuthURL } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await gotoAuthURL(page);
});

test('should be able to ban and unban a user', async ({
  authenticatedNhostPage: page,
}) => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });
  await page.waitForSelector(
    'div:has-text("User has been created successfully.")',
  );

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
