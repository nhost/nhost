import {
  TEST_PROJECT_NAME,
  TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { createTable, openProject } from '@/e2e/utils';
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
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = faker.random.word().toLowerCase();

  await createTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text' },
    ],
  });

  await page.waitForURL(
    `/${TEST_WORKSPACE_SLUG}/${TEST_PROJECT_SLUG}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
});

test('should create a table with unique constraints', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = faker.random.word().toLowerCase();

  await createTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text', unique: true },
      { name: 'isbn', type: 'text', unique: true },
    ],
  });

  await page.waitForURL(
    `/${TEST_WORKSPACE_SLUG}/${TEST_PROJECT_SLUG}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
});

test('should create a table with nullable columns', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = faker.random.word().toLowerCase();

  await createTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
    ],
  });

  await page.waitForURL(
    `/${TEST_WORKSPACE_SLUG}/${TEST_PROJECT_SLUG}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
});
