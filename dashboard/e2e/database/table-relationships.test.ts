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

  // Verify relationship is removed from the relationships list
  await expect(
    page.getByText(relationshipName, { exact: true }),
  ).not.toBeVisible();
});
