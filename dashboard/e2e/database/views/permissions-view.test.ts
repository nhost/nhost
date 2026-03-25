import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { clickPermissionButton, runSQLInEditor } from '@/e2e/utils';

const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

test('should set select permissions on a view', async ({
  authenticatedNhostPage: page,
}) => {
  const tableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const viewName = snakeCase(`e2e ${faker.lorem.words(2)}_view`);

  await runSQLInEditor(
    page,
    `CREATE TABLE public.${tableName} (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, PRIMARY KEY (id)); CREATE OR REPLACE VIEW public.${viewName} AS SELECT id, title FROM public.${tableName};`,
    { track: true },
  );

  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);

  await expect(
    page.getByRole('link', { name: viewName, exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: viewName, exact: true }).hover();
  await page
    .locator(`li:has-text("${viewName}") #view-management-menu-${viewName}`)
    .click();

  await page.getByRole('menuitem', { name: /edit permissions/i }).click();

  await clickPermissionButton({ page, role: 'user', permission: 'Select' });

  await page.getByLabel('Without any checks').click();
  await page.getByRole('button', { name: /select all/i }).click();

  await page.getByRole('button', { name: /save/i }).click();

  await expect(
    page.getByText(/permission has been saved successfully/i),
  ).toBeVisible();
});
