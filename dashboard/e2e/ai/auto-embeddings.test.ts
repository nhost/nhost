import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { navigateToProject } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });

  const AIRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/ai/auto-embeddings`;
  await page.goto(AIRoute);
  await page.waitForURL(AIRoute);
});

test('should create and delete an Auto-Embeddings', async ({
  authenticatedNhostPage: page,
}) => {
  await page
    .getByRole('button', {
      name: 'Add a new Auto-Embeddings Configuration',
      exact: true,
    })
    .click();

  await page.getByLabel('Name', { exact: true }).fill('test');
  await page.getByLabel('Table schema', { exact: true }).fill('auth');
  await page.getByLabel('Table', { exact: true }).fill('users');
  await page.getByLabel('Column', { exact: true }).fill('email');

  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('test', { exact: true })).toBeVisible();

  await page.getByLabel(/more options/i).click();
  await page.getByRole('menuitem', { name: /delete test/i }).click();

  await page
    .getByLabel('Confirm Delete Auto-Embeddings Configuration', {
      exact: true,
    })
    .check();
  await page
    .getByRole('button', {
      name: 'Delete Auto-Embeddings Configuration',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', { name: /No Auto-Embeddings are configured/i }),
  ).toBeVisible();
});
