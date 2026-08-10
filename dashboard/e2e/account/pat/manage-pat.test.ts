import { faker } from '@faker-js/faker';
import { expect, test } from '@/e2e/fixtures/auth-hook';

test('should be able to create then delete a personal access token', async ({
  authenticatedNhostPage: page,
}) => {
  await expect(
    page.getByRole('banner').getByRole('button').last(),
  ).toBeVisible();
  await page.getByRole('banner').getByRole('button').last().click();
  await page.getByRole('link', { name: /account settings/i }).click();
  await page
    .getByRole('button', { name: /create personal access token/i })
    .click();

  const createPATDialog = page.getByRole('dialog', {
    name: /create personal access token/i,
  });
  const patName = faker.lorem.slug(3);

  await createPATDialog.getByRole('textbox', { name: /name/i }).fill(patName);
  await createPATDialog.getByLabel('Expiration').click();
  await page.getByRole('option', { name: /7 days/i }).click();
  await createPATDialog.getByRole('button', { name: /create/i }).click();

  await expect(
    createPATDialog.getByText(
      /this token will not be shown again. make sure to copy it now./i,
    ),
  ).toBeVisible();

  await createPATDialog
    .getByRole('button', { name: /close personal access token dialog/i })
    .click();

  await expect(page.getByText(patName)).toBeVisible();

  await page
    .getByRole('button', { name: `More options for ${patName}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: /delete/i }).click();

  const deletePATDialog = page.getByRole('alertdialog', {
    name: /delete personal access token/i,
  });
  await deletePATDialog.getByRole('button', { name: /^delete$/i }).click();

  await expect(page.getByText(patName)).not.toBeVisible();
});
