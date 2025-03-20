import { expect, test } from '@/e2e/fixtures/auth-hook';

import { faker } from '@faker-js/faker';

test('should be able to create then delete a personal access token', async ({
  authenticatedNhostPage: page,
}) => {
  await page.waitForTimeout(1000);
  await page.getByRole('banner').getByRole('button').last().click();
  await page.getByRole('link', { name: /account settings/i }).click();
  await page
    .getByRole('button', { name: /create personal access token/i })
    .click();

  const patName = faker.lorem.slug(3);

  await page.getByRole('textbox', { name: /name/i }).fill(patName);
  await page.getByLabel('Expiration').click();
  await page.getByRole('option', { name: /7 days/i }).click();
  await page.getByRole('button', { name: /create/i }).click();

  await expect(
    page.getByText(
      /this token will not be shown again. make sure to copy it now./i,
    ),
  ).toBeVisible();

  await page.getByRole('button', { name: /close/i }).click();

  await expect(page.getByText(patName)).toBeVisible();

  await page
    .getByRole('button', { name: `More options for ${patName}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: /delete/i }).click();
  await page.getByRole('button', { name: /delete/i }).click();

  await expect(page.getByText(patName)).not.toBeVisible();
});
