import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import {
  clickPermissionButton,
  getGraphQLResult,
  navigateToGraphQLPlayground,
  navigateToSQLEditor,
  prepareTable,
  runGraphQLQuery,
  runSQL,
  setGraphQLHeaders,
} from '@/e2e/utils';

const tableName = snakeCase(faker.lorem.words(3));
const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;

test.describe
  .serial('permissions with custom check and GraphQL verification', () => {
    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({
        storageState: 'e2e/.auth/user.json',
      });
      const page = await context.newPage();

      await page.goto(databaseRoute);
      await page.waitForURL(databaseRoute);

      await page.getByRole('button', { name: /new table/i }).click();
      await expect(page.getByText(/create a new table/i)).toBeVisible();

      await prepareTable({
        page,
        name: tableName,
        primaryKeys: [],
        columns: [
          { name: 'title', type: 'text' },
          { name: 'genre', type: 'text' },
          { name: 'status', type: 'text' },
        ],
      });

      await page.getByRole('button', { name: /create/i }).click();

      await page.waitForURL(`${databaseRoute}/public/tables/${tableName}`);

      await expect(
        page.getByRole('link', { name: tableName, exact: true }),
      ).toBeVisible();

      await navigateToSQLEditor({ page });
      await runSQL({
        page,
        sql: `INSERT INTO public.${tableName} (title, genre, status) VALUES ('The Great Gatsby', 'fiction', 'published'), ('A Brief History of Time', 'science', 'published'), ('Draft Novel', 'fiction', 'draft');`,
      });

      await context.close();
    });

    test('public role should not be able to query books without permissions', async ({
      authenticatedNhostPage: page,
    }) => {
      await navigateToGraphQLPlayground({ page });

      await setGraphQLHeaders({
        page,
        headers: { 'x-hasura-role': 'public' },
      });

      await runGraphQLQuery({
        page,
        query: `query { ${tableName} { id title genre status } }`,
      });

      const result = await getGraphQLResult({ page });

      const hasError =
        result.includes('error') ||
        result.includes('not found in type') ||
        result.includes('not exist') ||
        result.includes('permission');
      expect(hasError).toBe(true);
    });

    test('public role should only see books matching custom check', async ({
      authenticatedNhostPage: page,
    }) => {
      await page.goto(`${databaseRoute}/public/tables/${tableName}`);
      await page.waitForURL(`${databaseRoute}/public/tables/${tableName}`);

      await page
        .locator(
          `li:has-text("${tableName}") #table-management-menu-${tableName}`,
        )
        .click();

      await page.getByRole('menuitem', { name: /edit permissions/i }).click();

      await clickPermissionButton({
        page,
        role: 'public',
        permission: 'Select',
      });

      await page.getByLabel('With custom check').click();

      await page.getByText('Add check').click();
      await page.locator('input[role="combobox"]').fill('genre');
      await page.locator('input[role="combobox"]').press('Enter');

      await page.getByText('Select variable...').click();
      await page.locator('input[role="combobox"]').fill('fiction');
      await page.getByRole('option', { name: /fiction/i }).click();

      await page.getByRole('button', { name: /add/i }).click();
      await page.locator('input[role="combobox"]').fill('status');
      await page.locator('input[role="combobox"]').press('Enter');

      await page.getByText('Select variable...').click();
      await page.locator('input[role="combobox"]').fill('published');
      await page.getByRole('option', { name: /published/i }).click();

      await page.getByRole('button', { name: /select all/i }).click();
      await page.getByRole('button', { name: /save/i }).click();

      await expect(
        page.getByText(/permission has been saved successfully/i),
      ).toBeVisible();

      await navigateToGraphQLPlayground({ page });

      await setGraphQLHeaders({
        page,
        headers: { 'x-hasura-role': 'public' },
      });

      await runGraphQLQuery({
        page,
        query: `query { ${tableName} { id title genre status } }`,
      });

      const result = await getGraphQLResult({ page });

      expect(result).toContain('The Great Gatsby');
      expect(result).not.toContain('A Brief History of Time');
      expect(result).not.toContain('Draft Novel');
    });
  });
