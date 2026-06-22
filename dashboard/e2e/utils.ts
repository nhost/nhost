import { faker } from '@faker-js/faker';
import type { FrameLocator, Page } from '@playwright/test';
import { add, format } from 'date-fns-v4';
import {
  TEST_ONBOARDING_USER,
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_ADMIN_SECRET,
  TEST_PROJECT_SUBDOMAIN,
  TEST_STAGING_REGION,
  TEST_STAGING_SUBDOMAIN,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
} from '@/e2e/env';
import { expect } from '@/e2e/fixtures/auth-hook';
import { isEmptyValue } from '@/lib/utils';
import type { Apps } from '@/utils/__generated__/graphql';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

const editorRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/editor`;

/**
 * Runs a SQL statement using the SQL Editor UI.
 *
 * @param page - The Playwright page object.
 * @param sql - The SQL statement to execute.
 * @param options - Optional settings.
 * @param options.track - Whether to enable the "Track this" toggle before running.
 * @returns A promise that resolves when the SQL has been executed successfully.
 */
export async function runSQLInEditor(
  page: Page,
  sql: string,
  options?: { track?: boolean },
) {
  await page.goto(editorRoute);
  await page.waitForURL(editorRoute);

  if (options?.track) {
    const trackLabel = page.getByText('Track this', { exact: true });
    await trackLabel.click();
  }

  const inputField = page.locator('[contenteditable]');
  await inputField.fill(sql);

  await page.locator('button[type="button"]', { hasText: /run/i }).click();
  await expect(page.getByText(/success/i)).toBeVisible();
}

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
        await page
          .getByPlaceholder(/name/i)
          .nth(calculatedIndex)
          .fill(columnName);

        await page
          .getByRole('combobox', { name: /type/i })
          .nth(calculatedIndex)
          .click();
        await page.keyboard.type(type);
        await page.getByRole('option', { name: type }).first().click();

        if (defaultValue) {
          await page
            .getByRole('combobox', { name: /default value/i })
            .nth(calculatedIndex)
            .click();
          await page.keyboard.type(defaultValue);
          await page
            .getByRole('option', { name: defaultValue })
            .first()
            .click();
        }

        if (unique) {
          await page
            .getByRole('checkbox', { name: /unique/i })
            .nth(calculatedIndex)
            .check();
        }

        if (nullable) {
          await page
            .getByRole('checkbox', { name: /nullable/i })
            .nth(calculatedIndex)
            .check();
        }

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
  for (const primaryKey of primaryKeys) {
    await expect(
      page.getByRole('option', { name: primaryKey, exact: true }),
    ).toBeVisible();
    await page.getByRole('option', { name: primaryKey, exact: true }).click();
    await page
      .locator(`div[data-testid="${primaryKey}"]`)
      .waitFor({ timeout: 1000 });
  }
  await page.getByText('Create a New Table').click();
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
  const authUrl = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/auth/users`;
  await page.goto(authUrl);
  await page.waitForURL(authUrl, { waitUntil: 'load' });
}

/**
 * Navigates to a URL and waits for the page to settle.
 *
 * By default it asserts the browser stays on `url` (the correct behavior for a
 * route that renders in place). Some routes — notably `/` — always redirect the
 * user away (to onboarding or an org route), so `waitForURL(url)` would wait
 * forever. Pass `expectRedirect: true` for those: the caller knows a redirect is
 * coming, so we wait until the browser actually leaves `url`.
 *
 * The redirect away from `/` is client-side (an effect in the index page that
 * runs after `useOrgs` resolves), so the initial document `load` fires while the
 * page is still on `/`. Waiting only for `load` returns on that intermediate
 * state, and a caller that immediately drives the header (e.g. the org switcher)
 * races the in-flight navigation, which tears down the just-opened popover. We
 * therefore wait for the URL to settle on the redirect target before returning.
 *
 * @param page - The Playwright page object.
 * @param url - The URL to navigate to.
 * @param options - Optional settings.
 * @param options.expectRedirect - Set when `url` is known to redirect elsewhere;
 *   waits for the browser to leave `url` instead of asserting it stays.
 */
export async function gotoUrl(
  page: Page,
  url: string,
  options: { expectRedirect?: boolean } = {},
) {
  await page.goto(url);

  if (options.expectRedirect) {
    const target = new URL(url, page.url()).href;
    await page.waitForURL((current) => current.href !== target, {
      waitUntil: 'load',
    });
    return;
  }

  await page.waitForURL(url, { waitUntil: 'load' });
}

export function getOrgSlugFromUrl(url: string) {
  const orgSlug = url.split('/orgs/')[1]?.split('/')[0];
  return orgSlug;
}

/**
 * Selects an organization by its name via the header org switcher, the same way
 * a user does, and waits until the URL carries the org's slug.
 *
 * The org name (what the user typed) is not the backend-assigned slug the routes
 * are keyed by, so we drive the switcher to navigate and then read the slug off
 * the resulting URL rather than looking it up out-of-band.
 *
 * @param page - The Playwright page object.
 * @param orgName - The exact (unique) name of the organization to select.
 * @returns A promise resolving to the organization's slug, parsed from the URL.
 */
export async function selectOrgByName(
  page: Page,
  orgName: string,
): Promise<string> {
  const switcher = page.getByTestId('org-switcher');
  await expect(switcher).toBeVisible();

  // The trigger toggles the popover, so guard on aria-expanded to open it once without a retry toggling it shut.
  if ((await switcher.getAttribute('aria-expanded')) !== 'true') {
    await switcher.click();
  }
  const search = page.getByPlaceholder('Select organization...');
  await expect(search).toBeVisible();

  // A just-created org can lag the popover opening, so retry only the search + option check, never the trigger click (which would toggle it shut).
  await expect(async () => {
    await search.fill('');
    await search.fill(orgName);
    await expect(page.getByRole('option', { name: orgName })).toBeVisible();
  }).toPass();

  await page.getByRole('option', { name: orgName }).click();
  await page.waitForURL('**/orgs/*/projects');

  return getOrgSlugFromUrl(page.url());
}

/**
 * Navigates to a page within the currently selected organization via the header
 * page switcher. Assumes the page is already on a route within the org.
 *
 * @param page - The Playwright page object.
 * @param label - The visible label of the org page to navigate to.
 * @returns A promise that resolves once the option has been selected.
 */
export async function gotoOrgPageViaSwitcher(
  page: Page,
  label: 'Billing' | 'Settings' | 'Members' | 'Projects',
) {
  await page.getByTestId('org-pages-switcher').click();
  await page.getByRole('option', { name: label, exact: true }).click();
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

  await expect(
    page.getByRole('heading', { name: 'Welcome to Nhost!' }),
  ).toBeVisible({ timeout: 20000 });
}

/**
 * Fills and submits the Stripe embedded checkout form rendered inside the
 * `embedded-checkout` iframe (used by both the onboarding paid-org flow and the
 * billing upgrade flow). Stripe's hosted form mounts asynchronously and varies
 * by region/experiment, so every interaction waits on the element it targets
 * rather than assuming a fixed layout.
 *
 * @param page - The Playwright page object.
 * @returns A promise that resolves once the payment has been submitted.
 */
export async function fillStripeCheckout(page: Page) {
  const stripeFrame: FrameLocator = page
    .locator('iframe[name="embedded-checkout"]')
    .first()
    .contentFrame();

  const emailField = stripeFrame.getByLabel('Email');
  await expect(emailField).toBeVisible({ timeout: 30000 });
  await emailField.fill(faker.internet.email());

  await stripeFrame
    .getByPlaceholder('1234 1234 1234 1234')
    .fill('4242424242424242');
  await stripeFrame.getByPlaceholder('MM / YY').fill(getCardExpiration());
  await stripeFrame.getByPlaceholder('CVC').fill('123');
  await stripeFrame
    .getByPlaceholder('Full name on card')
    .fill('EndyTo EndyTest');
  await stripeFrame.locator('#billingCountry').scrollIntoViewIfNeeded();

  const manualAddressLink = stripeFrame.getByText('Enter address manually');
  if (await manualAddressLink.isVisible()) {
    await stripeFrame.getByPlaceholder('Address', { exact: true }).click();
    await manualAddressLink.click();
    await stripeFrame
      .getByPlaceholder('Address line 1', { exact: true })
      .fill('123 Main Street');
    await stripeFrame
      .getByPlaceholder('City', { exact: true })
      .fill('Springfield');
    await stripeFrame.getByPlaceholder('ZIP', { exact: true }).fill('62701');
  }

  const stripePassToggle = stripeFrame.locator('#enableStripePass');
  if (await stripePassToggle.isChecked()) {
    await stripePassToggle.click({ force: true });
  }

  const submitButton = stripeFrame.getByTestId('hosted-payment-submit-button');
  await submitButton.scrollIntoViewIfNeeded();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
}

/**
 * Deletes the organization the page is currently scoped to. Assumes the page is
 * on a route within the organization (it navigates to its settings) and that
 * the org is empty enough to be deletable. Drives the two-checkbox confirmation
 * dialog and waits for the success toast and the redirect to the empty state.
 *
 * @param page - The Playwright page object.
 * @param orgSlug - The slug of the organization to delete.
 * @returns A promise that resolves once the organization has been deleted.
 */
export async function deleteOrganization(page: Page, orgSlug: string) {
  await gotoOrgPageViaSwitcher(page, 'Settings');
  await page.waitForURL(`**/orgs/${orgSlug}/settings`);

  await expect(
    page.getByRole('heading', { name: 'Delete Organization' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(
    page.getByRole('alertdialog').getByText('Delete Organization'),
  ).toBeVisible();

  const confirmButton = page.getByTestId('deleteOrgButton');
  await expect(confirmButton).toBeDisabled();

  await page.getByLabel("I'm sure I want to delete this Organization").check();
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel('I understand this action cannot be undone').check();
  await expect(confirmButton).toBeEnabled();

  await confirmButton.click();

  await expect(
    page.getByText('Successfully deleted the organization'),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole('heading', { name: 'Welcome to Nhost!' }),
  ).toBeVisible({ timeout: 30000 });
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

export async function cleanupRunServiceTestIfNeeded() {
  const signinUrl = `https://${TEST_STAGING_SUBDOMAIN}.auth.${TEST_STAGING_REGION}.nhost.run/v1/signin/email-password`;
  const graphqlUrl = `https://${TEST_STAGING_SUBDOMAIN}.graphql.${TEST_STAGING_REGION}.nhost.run/v1`;

  try {
    const signinResponse = await fetch(signinUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
    });
    const signinData = await signinResponse.json();
    const accessToken = signinData.session?.accessToken;

    if (!accessToken) {
      return;
    }

    const authHeader = `Bearer ${accessToken}`;

    const listResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        query: `
          query cleanupRunServices($subdomain: String!) {
            apps(where: { subdomain: { _eq: $subdomain } }) {
              id
              runServices {
                id
                config(resolve: false) {
                  name
                }
              }
            }
          }`,
        variables: { subdomain: TEST_PROJECT_SUBDOMAIN },
      }),
    });

    const listData = (await listResponse.json()) as {
      data?: { apps?: Array<Pick<Apps, 'id' | 'runServices'>> };
    };

    const app = listData.data?.apps?.[0];
    const appID = app?.id;
    const runServices = app?.runServices ?? [];

    if (!appID || isEmptyValue(runServices)) {
      return;
    }

    const servicesToDelete = runServices.filter((service) =>
      /^e2e-run-/.test(service.config?.name ?? ''),
    );

    await Promise.all(
      servicesToDelete.map(async (service) => {
        await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            query: `
              mutation cleanupDeleteRunService($serviceID: uuid!) {
                deleteRunService(id: $serviceID) {
                  id
                }
              }`,
            variables: { serviceID: service.id },
          }),
        });

        await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            query: `
              mutation cleanupDeleteRunServiceConfig($appID: uuid!, $serviceID: uuid!) {
                deleteRunServiceConfig(appID: $appID, serviceID: $serviceID) {
                  name
                }
              }`,
            variables: { appID, serviceID: service.id },
          }),
        });
      }),
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Opens the relationship dialog for a table.
 *
 * @param page - The Playwright page object.
 * @param tableName - The name of the table to open relationships for.
 * @returns A promise that resolves when the relationship dialog is open.
 */
export async function openRelationshipDialog({
  page,
  tableName,
}: {
  page: Page;
  tableName: string;
}) {
  await page
    .locator(`li:has-text("${tableName}") #table-management-menu-${tableName}`)
    .click();

  await page.getByRole('menuitem', { name: /edit relationships/i }).click();

  await page.getByRole('button', { name: /relationship/i }).click();

  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).toBeVisible();
}

/**
 * Creates a relationship between two tables.
 *
 * @param page - The Playwright page object.
 * @param relationshipName - The name of the relationship to create.
 * @param type - The type of relationship ('object' or 'array').
 * @param referenceTable - The reference table name.
 * @param sourceColumn - The source column name.
 * @param referenceColumn - The reference column name.
 * @param referenceSource - The reference source (defaults to 'default').
 * @param referenceSchema - The reference schema (defaults to 'public').
 * @returns A promise that resolves when the relationship is created.
 */
export async function createRelationship({
  page,
  relationshipName,
  type,
  referenceTable,
  sourceColumn,
  referenceColumn,
  referenceSource = 'default',
  referenceSchema = 'public',
}: {
  page: Page;
  relationshipName: string;
  type: 'object' | 'array';
  referenceTable: string;
  sourceColumn: string;
  referenceColumn: string;
  referenceSource?: string;
  referenceSchema?: string;
}) {
  await page.getByLabel(/relationship name/i).fill(relationshipName);

  await page.getByLabel(/relationship type/i).click();
  const relationshipTypeOption =
    type === 'object' ? /object relationship/i : /array relationship/i;
  await page.getByRole('option', { name: relationshipTypeOption }).click();

  await page.getByTestId('toReferenceSourceSelect').click();
  const sourceOption = page.getByRole('option', {
    name: referenceSource,
  });
  await sourceOption.first().click();

  await page.getByTestId('toReferenceSchemaSelect').click();
  await page.getByRole('option', { name: referenceSchema }).click();

  await page.getByTestId('toReferenceTableCombobox').click();
  await page.getByRole('option', { name: referenceTable, exact: true }).click();

  await expect(
    page.getByRole('button', { name: /add new mapping/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /add new mapping/i }).click();

  await page.getByTestId('fieldMapping.0.sourceColumn').click();
  await page.getByRole('option', { name: sourceColumn }).click();

  await page.getByTestId('fieldMapping.0.referenceColumn').click();
  await page.getByRole('option', { name: referenceColumn }).click();

  await page.getByRole('button', { name: /create relationship/i }).click();

  await page.waitForSelector(
    'div:has-text("Relationship created successfully.")',
    { timeout: 30000 },
  );

  await expect(
    page.getByRole('heading', { name: /create relationship/i }),
  ).not.toBeVisible();

  await expect(page.getByText(relationshipName, { exact: true })).toBeVisible();
}

/**
 * Deletes a relationship by name.
 *
 * @param page - The Playwright page object.
 * @param relationshipName - The name of the relationship to delete.
 * @returns A promise that resolves when the relationship is deleted.
 */
export async function navigateToSQLEditor({
  page,
}: {
  page: Page;
  orgSlug?: string;
  projectSubdomain?: string;
}) {
  await page.goto(editorRoute);
  await page.waitForURL(editorRoute);
}

export async function runSQL({ page, sql }: { page: Page; sql: string }) {
  const inputField = page.locator('[contenteditable]');
  await inputField.fill(sql);
  await page.locator('button[type="button"]', { hasText: /run/i }).click();
  await expect(page.getByText(/success/i)).toBeVisible();
}

export function waitForPlaygroundRolesLoaded(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(`${TEST_PROJECT_SUBDOMAIN}.graphql.`) &&
      (response.request().postData() ?? '')
        .toLowerCase()
        .includes('remoteappgetusersandauthroles'),
  );
}

export async function navigateToGraphQLPlayground({
  page,
  orgSlug = TEST_ORGANIZATION_SLUG,
  projectSubdomain = TEST_PROJECT_SUBDOMAIN,
}: {
  page: Page;
  orgSlug?: string;
  projectSubdomain?: string;
}) {
  const graphqlRoute = `/orgs/${orgSlug}/projects/${projectSubdomain}/graphql`;
  await page.goto(graphqlRoute);
  await page.waitForURL(graphqlRoute);
  await page
    .getByRole('button', { name: 'Execute GraphQL query' })
    .waitFor({ timeout: 30000 });
}

/**
 * Selects a role in the GraphiQL playground's Role dropdown
 * (`UserAndRoleSelect`). Unlike editing the Headers JSON, this Radix Select
 * updates `userHeaders` synchronously (no debounce), so the rebuilt fetcher
 * carries `x-hasura-role: <role>` on the next request the caller triggers.
 *
 * @param page - The Playwright page object.
 * @param role - The role to select (e.g. `public`).
 * @returns A promise that resolves once the role is selected.
 */
export async function selectGraphQLRole({
  page,
  role,
}: {
  page: Page;
  role: string;
}) {
  const roleTrigger = page.getByTestId('graphql-role-select');

  await expect(async () => {
    await roleTrigger.click();
    await page.getByRole('option', { name: role, exact: true }).click();
    await expect(roleTrigger).toContainText(role);
  }).toPass();
}

/**
 * Types a query into the GraphiQL editor and executes it. This drives the
 * playground exactly as a user does; callers assert on the rendered Result
 * Window (`page.getByLabel('Result Window')` with web-first matchers), which is
 * what the user actually sees, rather than on the raw HTTP response body.
 *
 * @param page - The Playwright page object.
 * @param query - The GraphQL query to execute.
 */
export async function runGraphQLQuery({
  page,
  query,
}: {
  page: Page;
  query: string;
}) {
  const queryEditor = page.getByRole('region', { name: 'Query Editor' });

  await queryEditor.locator('.CodeMirror textarea').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(query, { delay: 5 });

  // Dismiss any open autocomplete so Enter/clicks execute the query instead of hitting a hint.
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Execute GraphQL query' }).click();
}

export async function deleteRelationship({
  page,
  relationshipName,
}: {
  page: Page;
  relationshipName: string;
}) {
  await page.getByTestId(`delete-rel-${relationshipName}`).click();

  await expect(
    page.getByRole('heading', { name: /delete relationship/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^delete$/i }).click();

  await page.waitForSelector(
    'div:has-text("Relationship deleted successfully.")',
  );

  await expect(
    page.getByRole('heading', { name: /delete relationship/i }),
  ).not.toBeVisible();

  await expect(page.getByTestId(`delete-rel-${relationshipName}`)).toHaveCount(
    0,
  );
}
