import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import {
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_REMOTE_SCHEMA_NAME,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { prepareTable } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should create and delete an object relationship from scratch', async ({
  authenticatedNhostPage: page,
}) => {
  // Create reference table (authors)
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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${authorTableName}`,
  );

  // Create main table (books) with foreign key column
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const bookTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);

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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${bookTableName}`,
  );

  // Create object relationship
  const relationshipName = `object_rel_${faker.lorem.word()}`;

  // Press three horizontal dots more options button next to the table name
  await page
    .locator(
      `li:has-text("${bookTableName}") #table-management-menu-${bookTableName}`,
    )
    .click();

  await page.getByRole('menuitem', { name: /edit relationships/i }).click();

  await page.getByRole('button', { name: /relationship/i }).click();

  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).toBeVisible();

  // Fill relationship name
  await page.getByLabel(/relationship name/i).fill(relationshipName);

  // Select relationship type: Object
  await page.getByLabel(/relationship type/i).click();
  await page.getByRole('option', { name: /object relationship/i }).click();

  // Configure source/reference - select target table using data-testid
  await page.getByTestId('toReferenceSourceSelect').click();
  await page.getByRole('option', { name: /default/i }).click();

  await page.getByTestId('toReferenceSchemaSelect').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByTestId('toReferenceTableCombobox').click();
  await page
    .getByRole('option', { name: authorTableName, exact: true })
    .click();

  // Wait for field mapping to be available
  await page.waitForTimeout(1000);

  // Map columns: author_id -> id
  await page.getByRole('button', { name: /add new mapping/i }).click();

  // Use data-testid to find the field mapping selects (index 0 for first mapping)
  await page.getByTestId('fieldMapping.0.sourceColumn').click();
  await page.getByRole('option', { name: /author_id/i }).click();

  await page.getByTestId('fieldMapping.0.referenceColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  // Submit
  await page.getByRole('button', { name: /create relationship/i }).click();

  // Verify success toast appears
  await page.waitForSelector(
    'div:has-text("Relationship created successfully.")',
  );

  // Wait for the dialog to close
  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).not.toBeVisible();

  // Verify relationship appears in the relationships list
  await expect(page.getByText(relationshipName, { exact: true })).toBeVisible();

  // Delete the relationship
  await page.getByTestId(`delete-rel-${relationshipName}`).click();

  await expect(
    page.getByRole('heading', { name: /delete relationship/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^delete$/i }).click();

  // Verify deletion success
  await page.waitForSelector(
    'div:has-text("Relationship deleted successfully.")',
  );

  await page.waitForTimeout(1000);

  // Verify relationship is removed from the relationships list
  await expect(
    page.getByText(relationshipName, { exact: true }),
  ).not.toBeVisible();
});

test('should create and delete an array relationship from scratch', async ({
  authenticatedNhostPage: page,
}) => {
  // Create main table (authors)
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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${authorTableName}`,
  );

  // Create related table (books) with foreign key
  await page.getByRole('button', { name: /new table/i }).click();
  await expect(page.getByText(/create a new table/i)).toBeVisible();

  const bookTableName = snakeCase(`e2e ${faker.lorem.words(2)}`);

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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${bookTableName}`,
  );

  // Navigate back to author table to create array relationship
  await page.goto(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${authorTableName}`,
  );
  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${authorTableName}`,
  );

  // Create array relationship
  const relationshipName = `array_rel_${faker.lorem.word()}`;

  // Press three horizontal dots more options button next to the table name
  await page
    .locator(
      `li:has-text("${authorTableName}") #table-management-menu-${authorTableName}`,
    )
    .click();

  await page.getByRole('menuitem', { name: /edit relationships/i }).click();

  await page.getByRole('button', { name: /relationship/i }).click();

  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).toBeVisible();

  // Fill relationship name
  await page.getByLabel(/relationship name/i).fill(relationshipName);

  // Select relationship type: Array
  await page.getByLabel(/relationship type/i).click();
  await page.getByRole('option', { name: /array relationship/i }).click();

  // Configure source/reference - select target table (books) using data-testid
  await page.getByTestId('toReferenceSourceSelect').click();
  await page
    .getByRole('option', { name: /default/i })
    .first()
    .click();

  await page.getByTestId('toReferenceSchemaSelect').click();
  await page.getByRole('option', { name: /public/i }).click();

  await page.getByTestId('toReferenceTableCombobox').click();
  await page.getByRole('option', { name: bookTableName, exact: true }).click();

  // Wait for field mapping to be available
  await page.waitForTimeout(1000);

  // Map columns: books.author_id -> authors.id
  // For array relationships, we map from the related table's foreign key to the main table's primary key
  await page.getByRole('button', { name: /add new mapping/i }).click();

  // Use data-testid to find the field mapping selects (index 0 for first mapping)
  await page.getByTestId('fieldMapping.0.sourceColumn').click();
  await page.getByRole('option', { name: /id/i }).click();

  await page.getByTestId('fieldMapping.0.referenceColumn').click();
  await page.getByRole('option', { name: /author_id/i }).click();

  // Submit
  await page.getByRole('button', { name: /create relationship/i }).click();

  // Verify success toast appears
  await page.waitForSelector(
    'div:has-text("Relationship created successfully.")',
  );

  // Wait for the dialog to close
  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).not.toBeVisible();

  // Verify relationship appears in the relationships list
  await expect(page.getByText(relationshipName, { exact: true })).toBeVisible();

  // Delete the relationship
  await page.getByTestId(`delete-rel-${relationshipName}`).click();

  await expect(
    page.getByRole('heading', { name: /delete relationship/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^delete$/i }).click();

  // Verify deletion success
  await page.waitForSelector(
    'div:has-text("Relationship deleted successfully.")',
  );

  await page.waitForTimeout(1000);

  // Verify relationship is removed from the relationships list
  await expect(
    page.getByText(relationshipName, { exact: true }),
  ).not.toBeVisible();
});

test('should create and delete a remote schema relationship', async ({
  authenticatedNhostPage: page,
}) => {
  // Setup: Create a remote schema first
  const remoteSchemasRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas`;
  await page.goto(remoteSchemasRoute);
  await page.waitForURL(remoteSchemasRoute);

  const schemaName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const REMOTE_SCHEMA_TEST_URL = `https://${TEST_PROJECT_SUBDOMAIN}.functions.eu-central-1.staging.nhost.run/v1/${TEST_PROJECT_REMOTE_SCHEMA_NAME}`;

  await page.getByRole('button', { name: /add remote schema/i }).click();
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

  // Create a local table
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
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/public/${userTableName}`,
  );

  // Create remote schema relationship
  const relationshipName = `remote_rel_${faker.lorem.word()}`;

  // Press three horizontal dots more options button next to the table name
  await page
    .locator(
      `li:has-text("${userTableName}") #table-management-menu-${userTableName}`,
    )
    .click();

  await page.getByRole('menuitem', { name: /edit relationships/i }).click();

  await page.getByRole('button', { name: /relationship/i }).click();

  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).toBeVisible();

  // Fill relationship name
  await page.getByLabel(/relationship name/i).fill(relationshipName);

  // Select "Remote Schema" as reference kind
  // In the "To Reference" section, select the source dropdown using data-testid
  await page.getByTestId('toReferenceSourceSelect').click();
  // Remote schemas appear after a separator, look for the schema name
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: schemaName, exact: true }).click();

  // Wait for remote schema relationship details to load
  await page.waitForTimeout(2000);

  // The RemoteSchemaRelationshipDetails component should now be visible
  // It has a complex tree structure for selecting remote fields
  // For this test, we'll try to select the simplest path available

  // The "Root operation fields" section contains Query checkboxes with IDs like "root-query-{fieldName}"
  // These are unique to the Root operation fields section, so we can target them directly
  // to avoid matching the "Remote field preview" section above it
  const firstQueryCheckbox = page
    .locator('button[role="checkbox"][id^="root-query-"]')
    .first();

  // Wait for the checkbox to be visible and clickable
  await expect(firstQueryCheckbox).toBeVisible({ timeout: 5000 });
  await firstQueryCheckbox.click();
  await page.waitForTimeout(500);

  // Map LHS fields - these map table columns to remote schema arguments
  // Look for LHS field selectors (these are typically comboboxes)
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

  // Submit
  await page.getByRole('button', { name: /create relationship/i }).click();

  // Verify success toast appears
  await page.waitForSelector(
    'div:has-text("Relationship created successfully.")',
  );

  // Wait for the dialog to close
  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).not.toBeVisible();

  // Verify relationship appears in the relationships list
  await expect(page.getByText(relationshipName, { exact: true })).toBeVisible();

  // Delete the relationship (remote relationship)
  await page.getByTestId(`delete-rel-${relationshipName}`).click();

  await expect(
    page.getByRole('heading', { name: /delete relationship/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^delete$/i }).click();

  // Verify deletion success
  await page.waitForSelector(
    'div:has-text("Relationship deleted successfully.")',
  );

  await page.waitForTimeout(1000);

  // Verify relationship is removed from the relationships list
  await expect(
    page.getByText(relationshipName, { exact: true }),
  ).not.toBeVisible();

  // Cleanup: Delete the remote schema
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
