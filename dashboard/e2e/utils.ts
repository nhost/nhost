/* eslint-disable no-await-in-loop */
import {
  TEST_ONBOARDING_USER,
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_ADMIN_SECRET,
  TEST_PROJECT_SUBDOMAIN,
  TEST_STAGING_REGION,
  TEST_STAGING_SUBDOMAIN,
  TEST_USER_PASSWORD,
} from '@/e2e/env';
import { expect } from '@/e2e/fixtures/auth-hook';
import { isEmptyValue } from '@/lib/utils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import { faker } from '@faker-js/faker';
import { type Page } from '@playwright/test';
import { add, format } from 'date-fns-v4';

/**
 * Open a project by navigating to the project's overview page.
 *
 * @param page - The Playwright page object.
 * @param orgSlug - The slug of the organization that contains the project.
 * @param projectSubdomain - The subdomain of the project to open.
 * @returns A promise that resolves when the project is opened.
 */
export async function navigateToProject({
  page,
  orgSlug,
  projectSubdomain,
}: {
  page: Page;
  orgSlug: string;
  projectSubdomain: string;
}) {
  const projectUrl = `/orgs/${orgSlug}/projects/${projectSubdomain}`;

  try {
    await page.goto(projectUrl, { waitUntil: 'load' });
    await page.waitForURL(projectUrl, { timeout: 10000 });
  } catch (error) {
    console.error(`Failed to navigate to project URL: ${projectUrl}`, error);
  }
}

/**
 * Prepares a table by filling out the form.
 *
 * @param page - The Playwright page object.
 * @param name - The name of the table to create.
 * @param columns - The columns to create in the table.
 * @returns A promise that resolves when the table is prepared.
 */
export async function prepareTable({
  page,
  name: tableName,
  primaryKeys,
  columns,
}: {
  page: Page;
  name: string;
  primaryKeys: string[];
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    unique?: boolean;
    defaultValue?: string;
  }>;
}) {
  await page.getByRole('textbox', { name: /name/i }).first().fill(tableName);

  await Promise.all(
    columns.map(
      async (
        { name: columnName, type, nullable, unique, defaultValue },
        index,
      ) => {
        const calculatedIndex = index + 1;
        // set name
        await page
          .getByPlaceholder(/name/i)
          .nth(calculatedIndex)
          .fill(columnName);

        // set type
        await page
          .getByRole('table')
          .getByRole('combobox', { name: /type/i })
          .nth(calculatedIndex)
          .type(type);
        await page
          .getByRole('table')
          .getByRole('option', { name: type })
          .first()
          .click();

        // optionally set default value
        if (defaultValue) {
          await page
            .getByRole('table')
            .getByRole('combobox', { name: /default value/i })
            .nth(calculatedIndex)
            .type(defaultValue);
          await page
            .getByRole('table')
            .getByRole('option', { name: defaultValue })
            .first()
            .click();
        }

        // optionally check unique
        if (unique) {
          await page
            .getByRole('checkbox', { name: /unique/i })
            .nth(calculatedIndex)
            .check();
        }

        // optionally check nullable
        if (nullable) {
          await page
            .getByRole('checkbox', { name: /nullable/i })
            .nth(calculatedIndex)
            .check();
        }

        // add new column if not last
        if (index < columns.length - 1) {
          await page.getByRole('button', { name: /add column/i }).click();
        }
      },
    ),
  );
  await page.getByLabel('Primary Key').click();

  await page
    .getByRole('option', { name: columns[0].name, exact: true })
    .waitFor({ timeout: 1000 });
  await expect(
    page.getByRole('option', { name: columns[0].name, exact: true }),
  ).toBeVisible();
  // eslint-disable-next-line no-restricted-syntax
  for (const primaryKey of primaryKeys) {
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: primaryKey, exact: true }).click();
    await page
      .locator(`div[data-testid="${primaryKey}"]`)
      .waitFor({ timeout: 1000 });
  }
  await page.getByText('Create a New Table').click();
  await page.waitForTimeout(1000);
  await expect(
    page.getByRole('option', { name: columns[0].name, exact: true }),
  ).not.toBeVisible();
}

/**
 * Deletes a table with the given name.
 *
 * @param page - The Playwright page object.
 * @param name - The name of the table to delete.
 * @returns A promise that resolves when the table is deleted.
 */
export async function deleteTable({
  page,
  name,
}: {
  page: Page;
  name: string;
}) {
  const tableLink = page.getByRole('link', {
    name,
    exact: true,
  });

  await tableLink.hover();
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button')
    .click();

  await page.getByRole('menuitem', { name: /delete table/i }).click();
  await page.getByRole('button', { name: /delete/i }).click();
}

/**
 * Creates a new user.
 *
 * @param page - The Playwright page object.
 * @param email - The email of the user to create.
 * @param password - The password of the user to create.
 * @returns A promise that resolves when the user is created.
 */
export async function createUser({
  page,
  email,
  password,
}: {
  page: Page;
  email: string;
  password: string;
}) {
  await page
    .getByRole('button', { name: /create user/i })
    .first()
    .click();

  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /create/i, exact: true }).click();
}

/**
 * Generates a test email address with the given prefix (if provided).
 *
 * @param prefix - The prefix to use for the email address. (Default: `Nhost_Test_`)
 */
export function generateTestEmail(prefix: string = 'Nhost_Test_') {
  const email = faker.internet.email();

  return [prefix, email].join('');
}

export async function clickPermissionButton({
  page,
  role,
  permission,
}: {
  page: Page;
  role: string;
  permission: 'Insert' | 'Select' | 'Update' | 'Delete';
}) {
  const permissionIndex =
    ['Insert', 'Select', 'Update', 'Delete'].indexOf(permission) + 1;

  await page
    .locator('tr', { hasText: role })
    .locator('td')
    .nth(permissionIndex)
    .locator('button')
    .click();
}

export async function gotoAuthURL(page: Page) {
  const authUrl = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/users`;
  await page.goto(authUrl);
  await page.waitForURL(authUrl, { waitUntil: 'load' });
}

export async function gotoUrl(page: Page, url: string) {
  await page.goto(url);
  await page.waitForURL(url, { waitUntil: 'load' });
}

export function getOrgSlugFromUrl(url: string) {
  const orgSlug = url.split('/orgs/')[1].split('/projects/')[0];
  return orgSlug;
}

export function getCardExpiration() {
  const now = add(new Date(), { years: 3 });
  return format(now, 'MMyy');
}

export async function loginWithFreeUser(page: Page) {
  await page.goto('/');
  await page.waitForURL('/signin');
  await page.getByRole('link', { name: /continue with email/i }).click();

  await page.waitForURL('/signin/email');
  await page.getByLabel('Email').fill(TEST_ONBOARDING_USER);
  await page.getByLabel('Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForSelector('h2:has-text("Welcome to Nhost!")', {
    timeout: 20000,
  });
}

export function toPascalCase(str: string, divider = ' ') {
  return str
    .split(divider)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export async function cleanupOnboardingTestIfNeeded() {
  const signinUrl = `https://${TEST_STAGING_SUBDOMAIN}.auth.${TEST_STAGING_REGION}.nhost.run/v1/signin/email-password`;
  const graphqlUrl = `https://${TEST_STAGING_SUBDOMAIN}.graphql.${TEST_STAGING_REGION}.nhost.run/v1`;

  try {
    const response = await fetch(signinUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_ONBOARDING_USER,
        password: TEST_USER_PASSWORD,
      }),
    });
    const data = await response.json();

    const userId = data.session?.user?.id;
    const accessToken = data.session?.accessToken;
    const organizationPayload = {
      query: `
      query {
        organizations(where: { members: {userID: {_eq: "${userId}"}} }) {
          id
        }
      }`,
    };

    const authHeader = `Bearer ${accessToken}`;

    const orgResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(organizationPayload),
    });

    const orgData = await orgResponse.json();

    const organizations = orgData.data?.organizations;

    if (organizations && organizations.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Cleaning up organization');
      await Promise.all(
        organizations.map(({ id }) =>
          fetch(graphqlUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify({
              query: `
            mutation {
              billingDeleteOrganization(organizationID: "${id}")
            }
          `,
            }),
          }),
        ),
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    throw error;
  }
}

export async function cleanupRemoteSchemaTestIfNeeded() {
  try {
    const response = await fetch(
      `https://${TEST_PROJECT_SUBDOMAIN}.hasura.eu-central-1.staging.nhost.run/v1/metadata`,
      {
        method: 'POST',
        headers: {
          'x-hasura-admin-secret': TEST_PROJECT_ADMIN_SECRET,
        },
        body: JSON.stringify({
          type: 'export_metadata',
          version: 2,
          args: {},
        }),
      },
    );
    const data = (await response.json()) as ExportMetadataResponse;

    const remoteSchemas = data.metadata?.remote_schemas;

    if (isEmptyValue(remoteSchemas)) {
      return;
    }

    const schemasToDelete = remoteSchemas!.filter((remoteSchema) =>
      /^e2e_\w+_\w+$/.test(remoteSchema.name),
    );

    await Promise.all(
      schemasToDelete.map((remoteSchema) =>
        fetch(
          `https://${TEST_PROJECT_SUBDOMAIN}.hasura.eu-central-1.staging.nhost.run/v1/metadata`,
          {
            method: 'POST',
            headers: {
              'x-hasura-admin-secret': TEST_PROJECT_ADMIN_SECRET,
            },
            body: JSON.stringify({
              args: [
                {
                  type: 'remove_remote_schema',
                  args: {
                    name: remoteSchema.name,
                  },
                },
              ],
              source: 'default',
              type: 'bulk',
            }),
          },
        ),
      ),
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}
