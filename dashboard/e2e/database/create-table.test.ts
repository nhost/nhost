import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { navigateToProject, prepareTable } from '@/e2e/utils';
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

test('should create a simple table', async () => {
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
});

test('should create a table with unique constraints', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text', unique: true },
      { name: 'isbn', type: 'text', unique: true },
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
});

test('should create a table with nullable columns', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
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
});

test('should create a table with an identity column', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'int4' },
      { name: 'title', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
    ],
  });

  // await page.getByRole('button', { name: /identity/i }).click();
  await page.getByLabel('Identity').click();
  await page.getByRole('option', { name: /id/i }).click();

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
});

test('should create table with foreign key constraint', async () => {
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

  await page.locator('#columnName').click();
  await page.getByRole('option', { name: /author_id/i }).click();

  // select reference schema
  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  // select reference table
  await page.getByLabel('Table').click();
  await page.getByRole('option', { name: firstTableName, exact: true }).click();

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
});

test('should not be able to create a table with a name that already exists', async () => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text' },
    ],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  await prepareTable({
    page,
    name: tableName,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'title', type: 'text' },
      { name: 'author_id', type: 'uuid' },
    ],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await expect(
    page.getByText(/error: a table with this name already exists/i),
  ).toBeVisible();
});
