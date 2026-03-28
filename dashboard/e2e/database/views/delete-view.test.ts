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

test('should delete a view', async ({ authenticatedNhostPage: page }) => {
  const tableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const viewName = snakeCase(`e2e ${faker.lorem.words(2)}_view`);

  await runSQLInEditor(
    page,
    `CREATE TABLE public.${tableName} (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, PRIMARY KEY (id)); CREATE OR REPLACE VIEW public.${viewName} AS SELECT id, title FROM public.${tableName};`,
  );

  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);

  const viewLink = page.getByRole('link', { name: viewName, exact: true });
  await expect(viewLink).toBeVisible();

  await viewLink.hover();
  await page
    .getByRole('listitem')
    .filter({ hasText: viewName })
    .getByRole('button')
    .click();

  await page.getByRole('menuitem', { name: /delete view/i }).click();

  await page.getByRole('button', { name: /delete/i }).click();

  await expect(
    page.getByRole('link', { name: viewName, exact: true }),
  ).not.toBeVisible();
});

test('should delete a materialized view', async ({
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

  const matViewLink = page.getByRole('link', {
    name: matViewName,
    exact: true,
  });
  await expect(matViewLink).toBeVisible();

  await matViewLink.hover();
  await page
    .getByRole('listitem')
    .filter({ hasText: matViewName })
    .getByRole('button')
    .click();

  await page.getByRole('menuitem', { name: /delete view/i }).click();

  await page.getByRole('button', { name: /delete/i }).click();

  await expect(
    page.getByRole('link', { name: matViewName, exact: true }),
  ).not.toBeVisible();
});
