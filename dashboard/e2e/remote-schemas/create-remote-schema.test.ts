import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';
import {
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_REMOTE_SCHEMA_NAME,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { cleanupRemoteSchemaTestIfNeeded } from '@/e2e/utils';

const REMOTE_SCHEMA_TEST_URL = `https://${TEST_PROJECT_SUBDOMAIN}.functions.eu-central-1.staging.nhost.run/v1/${TEST_PROJECT_REMOTE_SCHEMA_NAME}`;

test.beforeAll(async () => {
  await cleanupRemoteSchemaTestIfNeeded();
});

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const remoteSchemasRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas`;
  await page.goto(remoteSchemasRoute);
  await page.waitForURL(remoteSchemasRoute);
});

test('should create and delete a remote schema from URL', async ({
  authenticatedNhostPage: page,
}) => {
  await page.getByRole('button', { name: /new remote schema/i }).click();
  await expect(page.getByText(/create a new remote schema/i)).toBeVisible();

  const schemaName = snakeCase(`e2e ${faker.lorem.words(2)}`);

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

  await expect(
    page.getByRole('link', { name: schemaName, exact: true }),
  ).toBeVisible();

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
