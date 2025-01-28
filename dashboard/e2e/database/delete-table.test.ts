import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { deleteTable, navigateToProject, prepareTable } from '@/e2e/utils';
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

test('should delete a table', async () => {
  const tableName = snakeCase(faker.lorem.words(3));

  await page.getByRole('button', { name: /new table/i }).click();

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text' },
    ],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await deleteTable({
    page,
    name: tableName,
  });

  // navigate to next URL
  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/**`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).not.toBeVisible();
});

test('should not be able to delete a table if other tables have foreign keys referencing it', async () => {
  test.setTimeout(60000);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const firstTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: firstTableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text' },
    ],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${firstTableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const secondTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: secondTableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text' },
      { name: 'author_id', type: 'uuid' },
    ],
  });

  await page.getByRole('button', { name: /add foreign key/i }).click();

  // select column in current table
  await page.locator('#columnName').click();

  await page.getByRole('option', { name: /author_id/i }).click();

  // select reference schema
  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  // select reference table
  await page.getByLabel('Table').click();
  await page.getByRole('option', { name: firstTableName, exact: true }).click();

  // select reference column
  await page.locator('#referencedColumn').click();
  await page.getByRole('option', { name: /id/i }).click();
  await page.getByRole('button', { name: /add/i }).click();

  await expect(
    page.getByText(`public.${firstTableName}.id`, { exact: true }),
  ).toBeVisible();

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${secondTableName}`,
  );

  await expect(
    page.getByRole('link', { name: secondTableName, exact: true }),
  ).toBeVisible();

  // try to delete the first table that is referenced by the second table
  await deleteTable({
    page,
    name: firstTableName,
  });

  await expect(
    page.getByText(
      /constraint [a-zA-Z_]+ on table [a-zA-Z_]+ depends on table [a-zA-Z_]+/i,
    ),
  ).toBeVisible();
});
