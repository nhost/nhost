import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { navigateToProject } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });

  const AIRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/ai/assistants`;
  await page.goto(AIRoute);
  await page.waitForURL(AIRoute);
});

test('should create and delete an Assistant', async ({
  authenticatedNhostPage: page,
}) => {
  const assistantName = `test-assistant-${Date.now()}`;
  const createAssistantButton = page
    .getByRole('button', { name: 'Create a new assistant', exact: true })
    .or(page.getByRole('button', { name: 'New', exact: true }))
    .first();

  await expect(createAssistantButton).toBeVisible();
  await createAssistantButton.click();

  await page.getByLabel('Name').fill(assistantName);
  await page.getByLabel('Description').fill('test');
  await page.getByLabel('Instructions').fill('test');
  await page.getByLabel('Model').fill('gpt-3.5-turbo-1106');

  await page.getByRole('button', { name: 'Create' }).click();

  const assistantNameLocator = page.getByText(assistantName, { exact: true });
  const assistantRow = assistantNameLocator.locator(
    'xpath=ancestor::*[.//button[@aria-label="More options"]][1]',
  );

  await expect(assistantNameLocator).toBeVisible();

  await assistantRow.getByLabel(/more options/i).click();
  await page.getByRole('menuitem', { name: `Delete ${assistantName}` }).click();

  await page.getByLabel('Confirm Delete Assistant').check();
  await page.getByRole('button', { name: 'Delete Assistant' }).click();

  await expect(assistantNameLocator).not.toBeVisible();
});
