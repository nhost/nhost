import { getDateComponents } from '@/utils/formatDate';
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

test.only('should be able to create then delete a personal access token', async () => {
  await page.waitForLoadState('networkidle');
  await page.getByRole('banner').getByRole('button').last().click();
  await page.getByRole('link', { name: /settings/i }).click();
  await page.getByRole('link', { name: /personal access tokens/i }).click();
  await page
    .getByRole('button', { name: /create personal access token/i })
    .click();

  const patName = faker.lorem.slug(3);
  const dateComponents = getDateComponents(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  );

  await page.getByRole('textbox', { name: /name/i }).fill(patName);
  await page
    .getByRole('textbox', { name: /expires at/i })
    .fill(
      `${dateComponents.year}-${dateComponents.month}-${dateComponents.day}`,
    );

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
