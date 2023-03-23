import type { Page } from '@playwright/test';

/**
 * Open a project by navigating to the project's overview page.
 *
 * @param page - The Playwright page object.
 * @param workspaceSlug - The slug of the workspace that contains the project.
 * @param projectSlug - The slug of the project to open.
 * @param projectName - The name of the project to open.
 * @returns A promise that resolves when the project is opened.
 */
export async function openProject({
  page,
  projectName,
  workspaceSlug,
  projectSlug,
}: {
  page: Page;
  workspaceSlug: string;
  projectSlug: string;
  projectName: string;
}) {
  await page.getByRole('link', { name: projectName }).click();
  await page.waitForURL(`/${workspaceSlug}/${projectSlug}`);
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
          .getByRole('combobox', { name: /type/i })
          .nth(index)
          .fill(type);
        await page.getByRole('option', { name: type }).first().click();

        // optionally set default value
        if (defaultValue) {
          await page
            .getByRole('combobox', { name: /default value/i })
            .first()
            .fill(defaultValue);
          await page
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
  await page.getByRole('button', { name: /primary key/i }).click();
  await page.getByRole('option', { name: primaryKey, exact: true }).click();
}
