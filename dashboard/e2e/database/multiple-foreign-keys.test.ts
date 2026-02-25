import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { prepareTable } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should create table with multiple foreign keys, then edit by removing one and adding a new one', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const firstRefTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: firstRefTableName,
    primaryKeys: [],
    columns: [{ name: 'name', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${firstRefTableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const secondRefTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: secondRefTableName,
    primaryKeys: [],
    columns: [{ name: 'title', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${secondRefTableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const thirdRefTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: thirdRefTableName,
    primaryKeys: [],
    columns: [{ name: 'category', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${thirdRefTableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const mainTableName = snakeCase(faker.lorem.words(3));

  await prepareTable({
    page,
    name: mainTableName,
    primaryKeys: [],
    columns: [
      { name: 'title', type: 'text' },
      { name: 'author_id', type: 'uuid' },
      { name: 'publisher_id', type: 'uuid' },
      { name: 'category_id', type: 'uuid' },
    ],
  });

  await page.getByRole('button', { name: /add foreign key/i }).click();

  await page.locator('#columnName').click();
  await page.getByRole('option', { name: /author_id/i }).click();

  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByLabel('Table').click();
  await page
    .getByRole('option', { name: firstRefTableName, exact: true })
    .click();

  await page.locator('#referencedColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  await page.getByRole('button', { name: /add/i }).click();

  await expect(
    page.getByTestId('foreignKeyFormSubmitButton'),
  ).not.toBeVisible();

  await expect(
    page.getByText(`public.${firstRefTableName}.id`, { exact: true }),
  ).toBeVisible();

  // Add second foreign key (publisher_id -> secondRefTableName)
  await page.getByRole('button', { name: /add foreign key/i }).click();

  await page.locator('#columnName').click();
  await page.getByRole('option', { name: /publisher_id/i }).click();

  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByLabel('Table').click();
  await page
    .getByRole('option', { name: secondRefTableName, exact: true })
    .click();

  await page.locator('#referencedColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  await page.getByRole('button', { name: /add/i }).click();

  await expect(
    page.getByTestId('foreignKeyFormSubmitButton'),
  ).not.toBeVisible();

  await expect(
    page.getByText(`public.${secondRefTableName}.id`, { exact: true }),
  ).toBeVisible();

  // Create the table
  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${mainTableName}`,
  );

  await expect(
    page.getByRole('link', { name: mainTableName, exact: true }),
  ).toBeVisible();

  // Now reopen the table to edit foreign keys
  await page
    .locator(
      `li:has-text("${mainTableName}") #table-management-menu-${mainTableName}`,
    )
    .click();
  await page.getByText('Edit Table').click();
  await expect(page.locator('h2:has-text("Edit Table")')).toBeVisible();

  // Verify both foreign keys are present
  await expect(
    page.getByText(`public.${firstRefTableName}.id`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`public.${secondRefTableName}.id`, { exact: true }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: /add foreign key/i })
    .scrollIntoViewIfNeeded();

  await page.getByText('Delete', { exact: true }).nth(1).click();
  await expect(
    page.getByText(`public.${secondRefTableName}.id`, { exact: true }),
  ).not.toBeVisible();

  await page.getByRole('button', { name: /add foreign key/i }).click();

  await page.locator('#columnName').click();
  await page.getByRole('option', { name: /category_id/i }).click();

  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByLabel('Table').click();
  await page
    .getByRole('option', { name: thirdRefTableName, exact: true })
    .click();

  await page.locator('#referencedColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  await page.getByRole('button', { name: /add/i }).click();

  await expect(
    page.getByTestId('foreignKeyFormSubmitButton'),
  ).not.toBeVisible();

  await expect(
    page.getByText(`public.${thirdRefTableName}.id`, { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText(`public.${firstRefTableName}.id`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`public.${thirdRefTableName}.id`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`public.${secondRefTableName}.id`, { exact: true }),
  ).not.toBeVisible();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(page.getByText(/error:/i)).not.toBeVisible();
  await expect(page.locator('h2:has-text("Edit Table")')).not.toBeVisible();

  await expect(
    page.getByRole('link', { name: mainTableName, exact: true }),
  ).toBeVisible();
});

test('should create table with multiple foreign keys pointing to the same column in the same table', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const addressTableName = snakeCase(faker.lorem.words(2));

  await prepareTable({
    page,
    name: addressTableName,
    primaryKeys: [],
    columns: [
      { name: 'street', type: 'text' },
      { name: 'city', type: 'text' },
      { name: 'postal_code', type: 'text' },
    ],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${addressTableName}`,
  );

  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const userTableName = snakeCase(faker.lorem.words(2));

  await prepareTable({
    page,
    name: userTableName,
    primaryKeys: [],
    columns: [
      { name: 'name', type: 'text' },
      { name: 'primary_address_id', type: 'uuid' },
      { name: 'secondary_address_id', type: 'uuid' },
    ],
  });

  await page.getByRole('button', { name: /add foreign key/i }).click();

  await page.locator('#columnName').click();
  await page.getByRole('option', { name: /primary_address_id/i }).click();

  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByLabel('Table').click();
  await page
    .getByRole('option', { name: addressTableName, exact: true })
    .click();

  await page.locator('#referencedColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  await page.getByRole('button', { name: /add/i }).click();

  await expect(
    page.getByTestId('foreignKeyFormSubmitButton'),
  ).not.toBeVisible();

  await expect(
    page.getByText(`public.${addressTableName}.id`, { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: /add foreign key/i }).click();

  await page.locator('#columnName').click();
  await page.getByRole('option', { name: /secondary_address_id/i }).click();

  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByLabel('Table').click();
  await page
    .getByRole('option', { name: addressTableName, exact: true })
    .click();

  await page.locator('#referencedColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  await page.getByRole('button', { name: /add/i }).click();

  await expect(
    page.getByTestId('foreignKeyFormSubmitButton'),
  ).not.toBeVisible();

  const foreignKeyReferences = page.getByText(`public.${addressTableName}.id`, {
    exact: true,
  });
  await expect(foreignKeyReferences).toHaveCount(2);

  await page.getByRole('button', { name: /create/i }).click();

  await expect(page.getByText(/error:/i)).not.toBeVisible();
  await expect(page.getByText(/create a new table/i)).not.toBeVisible();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${userTableName}`,
  );

  await expect(
    page.getByRole('link', { name: userTableName, exact: true }),
  ).toBeVisible();
});
