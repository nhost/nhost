import { createUser, generateTestEmail, gotoAuthURL } from '@/e2e/utils';
import { faker } from '@faker-js/faker';

import { expect, test } from '@/e2e/fixtures/auth-hook';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await gotoAuthURL(page);
});

test('should be able to delete a user', async ({
  authenticatedNhostPage: page,
}) => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });
  await page.waitForSelector(
    'div:has-text("User has been created successfully.")',
  );

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

test('should be able to delete a user from the details page', async ({
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
