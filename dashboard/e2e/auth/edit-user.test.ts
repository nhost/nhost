import { expect, test } from '@/e2e/fixtures/auth-hook';
import { createUser, generateTestEmail, gotoAuthURL } from '@/e2e/utils';
import { faker } from '@faker-js/faker';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await gotoAuthURL(page);
});

test('should be able to edit user roles from the details page', async ({
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

  await page.locator('#defaultRole').click();
  await page.getByRole('option', { name: /anonymous/i }).click();

  await page.getByLabel('anonymous').click();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText('User settings have been updated successfully.'),
  ).toBeVisible();
});
