import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { prepareTable, toPascalCase } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should create a simple table', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = toPascalCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [{ name: 'title', type: 'text' }],
  });

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'id' })).toBeVisible();
});

test('should create a table with unique constraints', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [
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

test('should create a table with nullable columns', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [
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
  await page
    .locator(`li:has-text("${tableName}") #table-management-menu-${tableName}`)
    .click();
  await page.getByText('Edit Table').click();
  await expect(page.locator('h2:has-text("Edit Table")')).toBeVisible();
  await expect(page.locator('div[data-testid="id"]')).toBeVisible();
});

test('should create a table with an identity column', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [
      { name: 'title', type: 'text', nullable: true },
      { name: 'description', type: 'text', nullable: true },
      { name: 'identity_column', type: 'int4' },
    ],
  });

  await page.getByLabel('Identity').click();
  await page.getByRole('option', { name: /identity_column/i }).click();

  // create table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();
  await page
    .locator(`li:has-text("${tableName}") #table-management-menu-${tableName}`)
    .click();
  await page.getByText('Edit Table').click();
  await expect(page.locator('h2:has-text("Edit Table")')).toBeVisible();
  await expect(
    page.locator('button#identityColumnIndex :has-text("identity_column")'),
  ).toBeVisible();
  await expect(page.locator('[id="columns.3.defaultValue"]')).toBeDisabled();
  await expect(page.locator('[name="columns.3.isNullable"]')).toBeDisabled();
  await expect(page.locator('[name="columns.3.isUnique"]')).toBeDisabled();
});

test('should create table with foreign key constraint', async ({
  authenticatedNhostPage: page,
}) => {
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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${firstTableName}`,
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
    page.getByTestId('foreignKeyFormSubmitButton'),
  ).not.toBeVisible();

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

test('should be able to create a table with a composite key', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: ['second_id'],
    columns: [
      { name: 'second_id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text' },
    ],
  });

  await expect(page.locator('div[data-testid="id"]')).toBeVisible();
  await expect(page.locator('div[data-testid="second_id"]')).toBeVisible();

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();

  await page
    .locator(`li:has-text("${tableName}") #table-management-menu-${tableName}`)
    .click();
  await page.getByText('Edit Table').click();
  await expect(page.locator('div[data-testid="id"]')).toBeVisible();
  await expect(page.locator('div[data-testid="second_id"]')).toBeVisible();
});

test('should not be able to create a table with a name that already exists', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [{ name: 'name', type: 'text' }],
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
    primaryKeys: [],
    columns: [
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

test('should be able to untrack and re-track a table', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const tableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: tableName,
    primaryKeys: [],
    columns: [{ name: 'title', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${tableName}`,
  );

  await expect(
    page.getByRole('link', { name: tableName, exact: true }),
  ).toBeVisible();

  await page
    .locator(`li:has-text("${tableName}") #table-management-menu-${tableName}`)
    .click();
  await page.getByRole('menuitem', { name: /edit graphql/i }).click();

  await expect(page.getByText('Tracked in GraphQL')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Untrack', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Untrack', exact: true }).click();
  await page.waitForSelector('div:has-text("Table untracked successfully.")');

  await page.getByRole('button', { name: /back/i }).click();

  await expect(page.getByRole('button', { name: /track now/i })).toBeVisible();

  await page.getByRole('button', { name: /track now/i }).click();
  await page.waitForSelector('div:has-text("Table tracked successfully.")');
});
