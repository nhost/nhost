import { faker } from '@faker-js/faker';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { createUser, generateTestEmail, gotoAuthURL } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await gotoAuthURL(page);
});

test('should create a user', async ({ authenticatedNhostPage: page }) => {
  const email = generateTestEmail();
  const password = faker.internet.password();

  await createUser({ page, email, password });
  await page.waitForSelector(
    'div:has-text("User has been created successfully.")',
  );

  await expect(
    page.getByRole('button', { name: `View ${email}`, exact: true }),
  ).toBeVisible();
});

test('should not be able to create a user with an existing email', async ({
  authenticatedNhostPage: page,
}) => {
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
