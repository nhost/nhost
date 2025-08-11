import { expect, test } from '@/e2e/fixtures/auth-hook';
import { createUser, generateTestEmail, gotoAuthURL } from '@/e2e/utils';
import { faker } from '@faker-js/faker';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await gotoAuthURL(page);
});

test('should be able to verify the email of a user', async ({
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

test('should be able to verify the phone number of a user', async ({
  authenticatedNhostPage: page,
}) => {
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
