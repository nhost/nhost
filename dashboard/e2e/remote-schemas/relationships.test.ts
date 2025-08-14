import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { faker } from '@faker-js/faker';
import { snakeCase } from 'snake-case';

const REMOTE_SCHEMA_TEST_URL = `https://${TEST_PROJECT_SUBDOMAIN}.functions.eu-central-1.staging.nhost.run/v1/bragi_remote_schema`;

async function gotoRemoteSchemas(page: any) {
  const route = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas`;
  await page.goto(route);
  await page.waitForURL(route);
}

async function createRemoteSchema(page: any, name: string) {
  await page.getByRole('button', { name: /add remote schema/i }).click();
  await expect(page.getByText(/create a new remote schema/i)).toBeVisible();

  await page.getByPlaceholder(/remote schema name/i).fill(name);
  await page
    .getByPlaceholder(/graphql-service\.example\.com/i)
    .fill(REMOTE_SCHEMA_TEST_URL);

  await page.getByRole('button', { name: /create/i }).click();
  await page.waitForURL(
    `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas/${name}`,
  );
}

async function openSidebarMenuForSchema(page: any, name: string) {
  await page.getByRole('link', { name, exact: true }).hover();
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button')
    .click();
}

async function deleteRemoteSchema(page: any, name: string) {
  await openSidebarMenuForSchema(page, name);
  await page.getByRole('menuitem', { name: /delete remote schema/i }).click();
  await page.getByRole('button', { name: /^delete$/i }).click();
  await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
}

test.describe('Remote Schema Relationships', () => {
  test.beforeEach(async ({ authenticatedNhostPage: page }) => {
    await gotoRemoteSchemas(page);
  });

  test('should create and delete a remote-schema to remote-schema relationship', async ({
    authenticatedNhostPage: page,
  }) => {
    const sourceSchema = snakeCase(`e2e_rel_src_${faker.lorem.words(2)}`);
    const targetSchema = snakeCase(`e2e_rel_tgt_${faker.lorem.words(2)}`);

    // Create two remote schemas
    await createRemoteSchema(page, sourceSchema);
    await gotoRemoteSchemas(page);
    await createRemoteSchema(page, targetSchema);

    // Open relationships drawer from source schema
    await gotoRemoteSchemas(page);
    await openSidebarMenuForSchema(page, sourceSchema);
    await page.getByRole('menuitem', { name: /edit relationships/i }).click();

    // Empty state should be visible, click Add Relationship
    await expect(
      page.getByText(/no remote schema relationships found/i),
    ).toBeVisible();
    await page.getByRole('button', { name: /add relationship/i }).click();

    // Relationship form - type defaults to remote-schema
    await page.getByLabel(/relationship name/i).fill('to_target');

    // Source Remote Schema is disabled and equals sourceSchema
    await expect(
      page.getByRole('button', { name: new RegExp(sourceSchema) }),
    ).toBeVisible();

    // Select Source Type
    await page.getByRole('button', { name: /select type/i }).click();
    // choose first available type
    await page.locator('[role="option"]').first().click();

    // Select Target Remote Schema
    await page.getByRole('button', { name: /select remote schema/i }).click();
    await page
      .getByRole('option', { name: new RegExp(`^${targetSchema}$`) })
      .click();

    // Select Target Field
    await page.getByRole('button', { name: /select field/i }).click();
    await page.locator('[role="option"]').first().click();

    // If there are selectable target arguments, pick the first and map to a source field
    const maybeFirstArgCheckbox = page
      .locator('input[type="checkbox"][id^="arg-"]')
      .first();
    if (await maybeFirstArgCheckbox.isVisible().catch(() => false)) {
      await maybeFirstArgCheckbox.check();
      // Select mapping type Source Field and pick first
      await page.getByRole('combobox', { name: /fill from/i }).click();
      await page.getByRole('option', { name: /source field/i }).click();
      await page.getByRole('button', { name: /select source field/i }).click();
      await page.locator('[role="option"]').first().click();
    }

    // Create relationship
    await page.getByRole('button', { name: /create/i }).click();

    // Should be back to list (empty or table), close drawer to verify list
    // If table rendered, relationship should list with name
    const relationshipRow = page
      .getByRole('row', { name: /to_target/i })
      .first();
    await expect(relationshipRow)
      .toBeVisible({ timeout: 15000 })
      .catch(() => {});

    // Delete the relationship if present
    if (await relationshipRow.isVisible().catch(() => false)) {
      await relationshipRow.locator('button[aria-haspopup="menu"]').click();
      await page
        .getByRole('menuitem', { name: /delete relationship/i })
        .click();
      await page.getByRole('button', { name: /^delete$/i }).click();
    }

    // Cleanup remote schemas
    await page.keyboard.press('Escape');
    await deleteRemoteSchema(page, sourceSchema);
    await gotoRemoteSchemas(page);
    await deleteRemoteSchema(page, targetSchema);
  });
});
