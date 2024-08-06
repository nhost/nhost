import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await page.goto('/');
});

test.afterAll(async () => {
  await page.close();
});

test('should be able to create then delete a personal access token', async () => {
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
