import {
  TEST_PROJECT_NAME,
  TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { openProject } from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/');

  await openProject({
    page,
    projectName: TEST_PROJECT_NAME,
    workspaceSlug: TEST_WORKSPACE_SLUG,
    projectSlug: TEST_PROJECT_SLUG,
  });

  await page
    .getByRole('navigation', { name: /main navigation/i })
    .getByRole('link', { name: /database/i })
    .click();
});

test.afterAll(async () => {
  await page.close();
});

test('should create a simple table', async () => {
  await expect(
    page.getByRole('button', { name: /schema\.public/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = faker.lorem
    .word({ length: { min: 8, max: 15 } })
    .toLowerCase();

  await page.getByRole('textbox', { name: /name/i }).first().fill(tableName);

  // prepare `id` column
  await page.getByPlaceholder(/name/i).first().fill('id');
  await page.getByRole('combobox', { name: /type/i }).first().fill('uuid');
  await page.getByRole('option', { name: /uuid/i }).click();
  await page
    .getByRole('combobox', { name: /default value/i })
    .first()
    .fill('gen_rand');
  await page.getByRole('option', { name: /gen_random_uuid()/i }).click();

  // add new column
  await page.getByRole('button', { name: /add column/i }).click();

  // prepare `title` column
  await page.getByPlaceholder(/name/i).nth(1).fill('title');
  await page.getByRole('combobox', { name: /type/i }).nth(1).fill('text');
  await page.getByRole('option', { name: /text/i }).first().click();
  await page
    .getByRole('checkbox', { name: /unique/i })
    .first()
    .check();

  // add new column
  await page.getByRole('button', { name: /add column/i }).click();

  // prepare `description` column
  await page.getByPlaceholder(/name/i).nth(2).fill('description');
  await page.getByRole('combobox', { name: /type/i }).nth(2).fill('text');
  await page.getByRole('option', { name: /text/i }).first().click();
  await page
    .getByRole('checkbox', { name: /nullable/i })
    .nth(2)
    .check();

  await page.getByRole('button', { name: /primary key/i }).click();
  await page.getByRole('option', { name: /id/i }).click();
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/${TEST_WORKSPACE_SLUG}/${TEST_PROJECT_SLUG}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
});
