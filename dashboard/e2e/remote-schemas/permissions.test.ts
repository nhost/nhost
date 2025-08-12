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

  await expect(page.getByRole('heading', { name })).toBeVisible();
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

test.describe('Remote Schema Permissions, Headers, and Customizations', () => {
  test.beforeEach(async ({ authenticatedNhostPage: page }) => {
    await gotoRemoteSchemas(page);
  });

  test('should add and remove permissions for a role', async ({
    authenticatedNhostPage: page,
  }) => {
    const schemaName = snakeCase(`e2e_perm_${faker.lorem.words(2)}`);

    await createRemoteSchema(page, schemaName);

    // Open permissions editor from sidebar menu
    await openSidebarMenuForSchema(page, schemaName);
    await page.getByRole('menuitem', { name: /edit permissions/i }).click();

    // Role list view should be visible
    await expect(
      page.getByText(new RegExp(`Remote Schema: ${schemaName}`, 'i')),
    ).toBeVisible();

    // Open editor for public role
    await page
      .locator('tr', { hasText: /^public$/i })
      .locator('td')
      .nth(1)
      .locator('button')
      .click();

    // Editor header
    await expect(
      page.getByText(
        new RegExp(`Edit Permissions: ${schemaName} - public`, 'i'),
      ),
    ).toBeVisible();

    // Wait for schema to load and toggle the first available checkbox
    const permissionCheckbox = page.getByRole('checkbox').first();
    await expect(permissionCheckbox).toBeVisible();
    await permissionCheckbox.click();
    await expect(permissionCheckbox).toBeChecked();

    // Save permissions
    const saveBtn = page.getByRole('button', { name: /save permissions/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Back to role list
    await expect(
      page.getByText(new RegExp(`Remote Schema: ${schemaName}`, 'i')),
    ).toBeVisible();

    // Re-open editor and ensure delete button is available (permission exists)
    await page
      .locator('tr', { hasText: /^public$/i })
      .locator('td')
      .nth(1)
      .locator('button')
      .click();
    await expect(
      page.getByRole('button', { name: /delete permissions/i }),
    ).toBeVisible();

    // Delete permissions
    await page.getByRole('button', { name: /delete permissions/i }).click();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Back to role list
    await expect(
      page.getByText(new RegExp(`Remote Schema: ${schemaName}`, 'i')),
    ).toBeVisible();

    // Cleanup
    await deleteRemoteSchema(page, schemaName);
  });

  test('should update headers and GraphQL customizations on a remote schema', async ({
    authenticatedNhostPage: page,
  }) => {
    const schemaName = snakeCase(`e2e_edit_${faker.lorem.words(2)}`);
    await createRemoteSchema(page, schemaName);

    // Open Edit Remote Schema
    await openSidebarMenuForSchema(page, schemaName);
    await page.getByRole('menuitem', { name: /edit remote schema/i }).click();
    await expect(page.getByText(/edit remote schema/i)).toBeVisible();

    // Add a custom header
    await page
      .getByRole('button', { name: /additional headers/i })
      .click({ trial: true })
      .catch(() => {});
    // The plus button in Additional headers section
    await page
      .locator('button:has(svg[width="20"][height="20"])')
      .first()
      .click();
    await page
      .getByPlaceholder(/header name/i)
      .first()
      .fill('x-e2e');
    // Value type defaults to Value; fill the value input
    await page
      .getByPlaceholder(/header value|env var name/i)
      .first()
      .fill('123');

    // Expand GraphQL Customizations and fill a few fields
    const addGqlCustomization = page.getByRole('button', {
      name: /add gql customization/i,
    });
    await addGqlCustomization.click();
    await page.getByPlaceholder(/^namespace_/i).fill('ns_');
    await page.getByPlaceholder(/^prefix_/i).fill('Pre');
    await page.getByPlaceholder(/_suffix$/i).fill('Suf');

    // Save update
    await page.getByRole('button', { name: /update/i }).click();
    await page.waitForURL(
      `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/remote-schemas/${schemaName}`,
    );

    // Verify header visible in details table
    await expect(page.getByText(/^headers$/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'x-e2e' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Value' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '123' })).toBeVisible();

    // Re-open edit and verify customizations persisted
    await openSidebarMenuForSchema(page, schemaName);
    await page.getByRole('menuitem', { name: /edit remote schema/i }).click();
    // Open customization section
    await page.getByRole('button', { name: /add gql customization/i }).click();
    await expect(
      page.locator('#definition\\.customization\\.root_fields_namespace'),
    ).toHaveValue('ns_');
    await expect(
      page.locator('#definition\\.customization\\.type_prefix'),
    ).toHaveValue('Pre');
    await expect(
      page.locator('#definition\\.customization\\.type_suffix'),
    ).toHaveValue('Suf');

    // Close drawer
    await page.getByRole('button', { name: /cancel/i }).click();

    // Cleanup
    await deleteRemoteSchema(page, schemaName);
  });
});
