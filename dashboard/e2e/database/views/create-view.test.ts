import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { runSQLInEditor } from '@/e2e/utils';

const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should create a view and display its definition', async ({
  authenticatedNhostPage: page,
}) => {
  const tableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const viewName = snakeCase(`e2e ${faker.lorem.words(2)}_view`);

  await runSQLInEditor(
    page,
    `CREATE TABLE public.${tableName} (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, PRIMARY KEY (id)); CREATE OR REPLACE VIEW public.${viewName} AS SELECT id, title FROM public.${tableName};`,
  );

  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);

  await expect(
    page.getByRole('link', { name: viewName, exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: viewName, exact: true }).click();

  await page
    .locator(`li:has-text("${viewName}") #view-management-menu-${viewName}`)
    .click();

  await page.getByRole('menuitem', { name: /edit view/i }).click();

  await expect(
    page.getByRole('heading', { name: /view definition/i }),
  ).toBeVisible();

  await expect(page.locator('.cm-content').getByText('SELECT')).toBeVisible();

  await expect(
    page.locator('.cm-content').getByText('CREATE OR REPLACE VIEW'),
  ).toBeVisible();
});

test('should create a materialized view and display its definition', async ({
  authenticatedNhostPage: page,
}) => {
  const tableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const matViewName = snakeCase(`e2e ${faker.lorem.words(2)}_matview`);

  await runSQLInEditor(
    page,
    `CREATE TABLE public.${tableName} (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, PRIMARY KEY (id)); CREATE MATERIALIZED VIEW public.${matViewName} AS SELECT id, title FROM public.${tableName};`,
  );

  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);

  await expect(
    page.getByRole('link', { name: matViewName, exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: matViewName, exact: true }).click();

  await page
    .locator(
      `li:has-text("${matViewName}") #view-management-menu-${matViewName}`,
    )
    .click();

  await page.getByRole('menuitem', { name: /edit materialized view/i }).click();

  await expect(
    page.getByRole('heading', { name: /materialized view definition/i }),
  ).toBeVisible();

  await expect(page.locator('.cm-content').getByText('SELECT')).toBeVisible();
});
