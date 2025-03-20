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
  await page.getByRole('link', { name: 'Assistants' }).click();

  await expect(page.getByText(/no assistants are configured/i)).toBeVisible();

  await page.getByRole('button', { name: 'Create a new assistant' }).click();
  await page.getByLabel('Name').fill('test');
  await page.getByLabel('Description').fill('test');
  await page.getByLabel('Instructions').fill('test');
  await page.getByLabel('Model').fill('gpt-3.5-turbo-1106');

  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: /test/i })).toBeVisible();

  await page.getByLabel(/more options/i).click();
  await page.getByRole('menuitem', { name: /delete test/i }).click();

  await page.getByLabel('Confirm Delete Assistant').check();
  await page.getByRole('button', { name: 'Delete Assistant' }).click();

  await expect(
    page.getByRole('heading', { name: /no assistants are configured/i }),
  ).toBeVisible();
});
