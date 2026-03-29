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

test('should delete a function', async ({ authenticatedNhostPage: page }) => {
  const tableName = snakeCase(`e2e ${faker.lorem.words(2)}`);
  const functionName = snakeCase(`e2e ${faker.lorem.words(2)}_fn`);

  await runSQLInEditor(
    page,
    `CREATE TABLE public.${tableName} (id uuid DEFAULT gen_random_uuid() NOT NULL, title text NOT NULL, PRIMARY KEY (id)); CREATE OR REPLACE FUNCTION public.${functionName}(filter_title text) RETURNS SETOF public.${tableName} LANGUAGE sql STABLE AS $$ SELECT * FROM public.${tableName} WHERE title = filter_title; $$;`,
  );

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
