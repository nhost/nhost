import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

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
    await page.goto(projectUrl, { waitUntil: 'networkidle' });
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
  primaryKey,
  columns,
}: {
  page: Page;
  name: string;
  primaryKey: string;
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    unique?: boolean;
    defaultValue?: string;
  }>;
}) {
  if (!columns.some(({ name }) => name === primaryKey)) {
    throw new Error('Primary key must be one of the columns.');
  }

  await page.getByRole('textbox', { name: /name/i }).first().fill(tableName);

  await Promise.all(
    columns.map(
      async (
        { name: columnName, type, nullable, unique, defaultValue },
        index,
      ) => {
        // set name
        await page.getByPlaceholder(/name/i).nth(index).fill(columnName);

        // set type
        await page
          .getByRole('table')
          .getByRole('combobox', { name: /type/i })
          .nth(index)
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
            .nth(index)
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
            .nth(index)
            .check();
        }

        // optionally check nullable
        if (nullable) {
          await page
            .getByRole('checkbox', { name: /nullable/i })
            .nth(index)
            .check();
        }

        // add new column if not last
        if (index < columns.length - 1) {
          await page.getByRole('button', { name: /add column/i }).click();
        }
      },
    ),
  );

  // select the first column as primary key
  // await page.getByRole('button', { name: /primary key/i }).click();
  await page.getByLabel('Primary Key').click();
  await page.getByRole('option', { name: primaryKey, exact: true }).click();
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
