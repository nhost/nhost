import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { navigateToSQLEditor, runSQL } from '@/e2e/utils';

const tableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
const functionName = snakeCase(`e2e ${faker.lorem.words(2)}_fn`);
const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;

test.describe
  .serial('database functions', () => {
    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({
        storageState: 'e2e/.auth/user.json',
      });
      const page = await context.newPage();

      await page.goto(databaseRoute);
      await page.waitForURL(databaseRoute);

      await navigateToSQLEditor({ page });
      await runSQL({
        page,
        sql: `CREATE TABLE public.${tableName} (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, PRIMARY KEY (id)); CREATE OR REPLACE FUNCTION public.${functionName}(filter_title text) RETURNS SETOF public.${tableName} LANGUAGE sql STABLE AS $$ SELECT * FROM public.${tableName} WHERE title = filter_title; $$;`,
      });

      await context.close();
    });

    test('should display function definition, metadata, parameters, and SQL', async ({
      authenticatedNhostPage: page,
    }) => {
      await page.goto(databaseRoute);
      await page.waitForURL(databaseRoute);

      await expect(
        page.getByRole('link', { name: functionName, exact: true }),
      ).toBeVisible();

      await page.getByRole('link', { name: functionName, exact: true }).click();

      await expect(
        page.getByRole('heading', { name: /function definition/i }),
      ).toBeVisible();
      await expect(page.getByText(`public.${functionName}`)).toBeVisible();
      await expect(page.getByText('STABLE').first()).toBeVisible();
      await expect(page.getByText('SQL function')).toBeVisible();
      await expect(page.getByText('Query-only')).toBeVisible();

      await expect(page.getByText('Parameters')).toBeVisible();
      await expect(page.getByText('filter_title')).toBeVisible();

      await page
        .locator(
          `li:has-text("${functionName}") #function-management-menu-${functionName}`,
        )
        .click();

      await page.getByRole('menuitem', { name: /edit function/i }).click();

      await expect(page.locator('.cm-content')).toBeVisible();
      await expect(
        page.locator('.cm-content').getByText('CREATE OR REPLACE FUNCTION'),
      ).toBeVisible();
    });

    test('should delete the function', async ({
      authenticatedNhostPage: page,
    }) => {
      await page.goto(databaseRoute);
      await page.waitForURL(databaseRoute);

      const functionLink = page.getByRole('link', {
        name: functionName,
        exact: true,
      });
      await expect(functionLink).toBeVisible();

      await functionLink.hover();
      await page
        .getByRole('listitem')
        .filter({ hasText: functionName })
        .getByRole('button')
        .click();

      await page.getByRole('menuitem', { name: /delete function/i }).click();

      await page.getByRole('button', { name: /delete/i }).click();

      await expect(
        page.getByRole('link', { name: functionName, exact: true }),
      ).not.toBeVisible();
    });
  });
