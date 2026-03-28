import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import {
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_REMOTE_SCHEMA_NAME,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import {
  createRelationship,
  deleteRelationship,
  openRelationshipDialog,
  prepareTable,
} from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should create and delete an object relationship from scratch', async ({
  authenticatedNhostPage: page,
}) => {
  const authorTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  await prepareTable({
    page,
    name: authorTableName,
    primaryKeys: [],
    columns: [{ name: 'name', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${authorTableName}`,
  );

  const bookTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  await prepareTable({
    page,
    name: bookTableName,
    primaryKeys: [],
    columns: [
      { name: 'title', type: 'text' },
      { name: 'author_id', type: 'uuid' },
    ],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${bookTableName}`,
  );

  const relationshipName = `object_rel_${faker.lorem.word()}`;

  await openRelationshipDialog({ page, tableName: bookTableName });

  await createRelationship({
    page,
    relationshipName,
    type: 'object',
    referenceTable: authorTableName,
    sourceColumn: 'author_id',
    referenceColumn: 'id',
  });

  await deleteRelationship({ page, relationshipName });
});

test('should create and delete an array relationship from scratch', async ({
  authenticatedNhostPage: page,
}) => {
  const authorTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  await prepareTable({
    page,
    name: authorTableName,
    primaryKeys: [],
    columns: [{ name: 'name', type: 'text' }],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${authorTableName}`,
  );

  const bookTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  await prepareTable({
    page,
    name: bookTableName,
    primaryKeys: [],
    columns: [
      { name: 'title', type: 'text' },
      { name: 'author_id', type: 'uuid' },
    ],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${bookTableName}`,
  );

  await page.goto(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${authorTableName}`,
  );
  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${authorTableName}`,
  );

  const relationshipName = `array_rel_${faker.lorem.word()}`;

  await openRelationshipDialog({ page, tableName: authorTableName });

  await createRelationship({
    page,
    relationshipName,
    type: 'array',
    referenceTable: bookTableName,
    sourceColumn: 'id',
    referenceColumn: 'author_id',
  });

  await deleteRelationship({ page, relationshipName });
});

test('should create and delete a remote schema relationship', async ({
  authenticatedNhostPage: page,
}) => {
  const remoteSchemasRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas`;
  await page.goto(remoteSchemasRoute);
  await page.waitForURL(remoteSchemasRoute);

  const schemaName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const REMOTE_SCHEMA_TEST_URL = `https://${TEST_PROJECT_SUBDOMAIN}.functions.eu-central-1.staging.nhost.run/v1/${TEST_PROJECT_REMOTE_SCHEMA_NAME}`;

  await page.getByRole('button', { name: /new remote schema/i }).click();
  await expect(page.getByText(/create a new remote schema/i)).toBeVisible();

  await page.getByPlaceholder(/remote schema name/i).fill(schemaName);
  await page
    .getByPlaceholder(/graphql-service\.example\.com/i)
    .fill(REMOTE_SCHEMA_TEST_URL);

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForSelector(
    'div:has-text("The remote schema has been created successfully.")',
  );

  const detailsUrl = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas/${schemaName}`;
  await page.waitForURL(detailsUrl);

  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);

  const userTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  await prepareTable({
    page,
    name: userTableName,
    primaryKeys: [],
    columns: [
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
    ],
  });

  await page.getByRole('button', { name: /create/i }).click();

  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/tables/${userTableName}`,
  );

  const relationshipName = `remote_rel_${faker.lorem.word()}`;

  await openRelationshipDialog({ page, tableName: userTableName });

  await page.getByLabel(/relationship name/i).fill(relationshipName);

  await page.getByTestId('toReferenceSourceSelect').click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: schemaName, exact: true }).click();

  await page.waitForTimeout(2000);

  const firstQueryCheckbox = page
    .locator('button[role="checkbox"][id^="root-query-"]')
    .first();

  await expect(firstQueryCheckbox).toBeVisible({ timeout: 5000 });
  await firstQueryCheckbox.click();
  await page.waitForTimeout(500);

  const lhsFieldLabels = page
    .locator('label')
    .filter({ hasText: /lhs field/i });

  if ((await lhsFieldLabels.count()) > 0) {
    const lhsFieldCombobox = lhsFieldLabels
      .first()
      .locator('..')
      .getByRole('combobox')
      .first();

    if (
      await lhsFieldCombobox.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await lhsFieldCombobox.click();
      await page.waitForTimeout(500);
      await page.getByRole('option').first().click();
    }
  }

  await page.getByRole('button', { name: /create relationship/i }).click();

  await page.waitForSelector(
    'div:has-text("Relationship created successfully.")',
  );

  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).not.toBeVisible();

  await expect(page.getByText(relationshipName, { exact: true })).toBeVisible();

  await deleteRelationship({ page, relationshipName });

  await page.goto(remoteSchemasRoute);
  await page.waitForURL(remoteSchemasRoute);

  const schemaLink = page.getByRole('link', {
    name: schemaName,
    exact: true,
  });

  await schemaLink.hover();
  await page
    .getByRole('listitem')
    .filter({ hasText: schemaName })
    .getByRole('button')
    .click();

  await page.getByRole('menuitem', { name: /delete remote schema/i }).click();
  await page.getByRole('button', { name: /^delete$/i }).click();

  await expect(
    page.getByRole('link', { name: schemaName, exact: true }),
  ).toHaveCount(0);
});
