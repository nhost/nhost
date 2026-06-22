import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import {
  clickPermissionButton,
  navigateToGraphQLPlayground,
  navigateToSQLEditor,
  prepareTable,
  runGraphQLQuery,
  runSQL,
  selectGraphQLRole,
  waitForPlaygroundRolesLoaded,
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

    test.afterAll(async ({ browser }) => {
      // Drop the suite's table so a beforeAll CI retry doesn't hit "table already exists" or leave staging polluted.
      const context = await browser.newContext({
        storageState: 'e2e/.auth/user.json',
      });
      const page = await context.newPage();

      await navigateToSQLEditor({ page });
      await runSQL({
        page,
        sql: `DROP TABLE IF EXISTS public.${tableName} CASCADE;`,
      });

      await context.close();
    });

    test('public role should not be able to query books without permissions', async ({
      authenticatedNhostPage: page,
    }) => {
      const rolesLoaded = waitForPlaygroundRolesLoaded(page);
      await navigateToGraphQLPlayground({ page });
      await rolesLoaded;

      await selectGraphQLRole({ page, role: 'public' });

      await runGraphQLQuery({
        page,
        query: `query { ${tableName} { id title genre status } }`,
      });

      await expect(page.getByLabel('Result Window')).toContainText(
        /field '.*' not found in type|not exist|permission/i,
      );
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

      const columnSearch = page.locator(
        'input[role="combobox"][placeholder="Search..."]',
      );
      const variableSearch = page.locator(
        'input[role="combobox"][placeholder="Choose variable..."]',
      );

      await page.getByText('Add check').click();
      await columnSearch.fill('genre');
      await page.locator('[cmdk-item][data-value="genre"]').click();

      await page.getByText('Select variable...').click();
      await variableSearch.fill('fiction');
      await page.locator('[cmdk-item][data-value="create"]').click();

      await page.getByRole('button', { name: /^add$/i }).click();
      await columnSearch.fill('status');
      await page.locator('[cmdk-item][data-value="status"]').click();

      await page.getByText('Select variable...').click();
      await variableSearch.fill('published');
      await page.locator('[cmdk-item][data-value="create"]').click();

      await page.getByRole('button', { name: /select all/i }).click();
      await page.getByRole('button', { name: /save/i }).click();

      await expect(
        page.getByText(/permission has been saved successfully/i),
      ).toBeVisible();

      const rolesLoaded = waitForPlaygroundRolesLoaded(page);
      await navigateToGraphQLPlayground({ page });
      await rolesLoaded;

      await selectGraphQLRole({ page, role: 'public' });

      await runGraphQLQuery({
        page,
        query: `query { ${tableName} { id title genre status } }`,
      });

      const resultWindow = page.getByLabel('Result Window');
      await expect(resultWindow).toContainText('The Great Gatsby');
      await expect(resultWindow).not.toContainText('A Brief History of Time');
      await expect(resultWindow).not.toContainText('Draft Novel');
    });
  });
