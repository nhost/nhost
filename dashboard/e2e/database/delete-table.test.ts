import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';

import { expect, test } from '@/e2e/fixtures/auth-hook';
import { deleteTable, prepareTable } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should delete a table', async ({ authenticatedNhostPage: page }) => {
  const tableName = snakeCase(faker.lorem.words(3));

  await page.getByRole('button', { name: /new table/i }).click();

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [{ name: 'title', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${tableName}`,
  );

  await deleteTable({
    page,
    name: tableName,
  });

  // navigate to next URL
  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/**`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).not.toBeVisible();
});

test('should not be able to delete a table if other tables have foreign keys referencing it', async ({
  authenticatedNhostPage: page,
}) => {
  test.setTimeout(60000);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const firstTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: firstTableName,
    primaryKeys: [],
    columns: [{ name: 'name', type: 'text' }],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${firstTableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const secondTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: secondTableName,
    primaryKeys: [],
    columns: [
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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${secondTableName}`,
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
