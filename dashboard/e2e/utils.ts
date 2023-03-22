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
