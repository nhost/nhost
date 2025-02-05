import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import {
  clickPermissionButton,
  navigateToProject,
  prepareTable,
} from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { snakeCase } from 'snake-case';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await page.goto('/');

  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });

  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test.afterAll(async () => {
  await page.close();
});

test('should create a table with role permissions to select row', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text' },
    ],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();

  // Press three horizontal dots more options button next to the table name
  await page
    .locator(`li:has-text("${tableName}") #table-management-menu button`)
    .click();

  await page.getByRole('menuitem', { name: /edit permissions/i }).click();

  await clickPermissionButton({ page, role: 'user', permission: 'Select' });

  await page.getByLabel('Without any checks').click();
  await page.getByRole('button', { name: /select all/i }).click();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText(/permission has been saved successfully/i),
  ).toBeVisible();
});

test('should create a table with role permissions and a custom check to select rows', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text' },
    ],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();

  // Press three horizontal dots more options button next to the table name
  await page
    .locator(`li:has-text("${tableName}") #table-management-menu button`)
    .click();

  await page.getByRole('menuitem', { name: /edit permissions/i }).click();

  await clickPermissionButton({ page, role: 'user', permission: 'Select' });

  await page.getByLabel('With custom check').click();

  // await page.getByRole('combobox', { name: /select a column/i }).click();
  await page.getByText('Select a column', { exact: true }).click();

  const columnSelector = page.locator('input[role="combobox"]');

  await columnSelector.fill('id');

  await columnSelector.press('Enter');

  await expect(page.getByText(/_eq/i)).toBeVisible();

  // limit on number of rows fetched per request.
  await page.locator('#limit').fill('100');

  await page.getByText('Select variable...', { exact: true }).click();

  const variableSelector = await page.locator('input[role="combobox"]');

  await variableSelector.fill('X-Hasura-User-Id');

  await variableSelector.press('Enter');

  await page.getByRole('button', { name: /select all/i }).click();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText(/permission has been saved successfully/i),
  ).toBeVisible();
});
