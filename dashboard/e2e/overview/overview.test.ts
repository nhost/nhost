import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { navigateToProject } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });
});

test('should show the navtree with all links visible', async ({
  authenticatedNhostPage: page,
}) => {
  const navLocator = page.getByLabel('Navigation Tree');
  await expect(navLocator).toBeVisible();

  const links = [
    'Nhost Automation Test Project',
    'Overview',
    'Database',
    'GraphQL',
    'Hasura',
    'Auth',
    'Storage',
    'Run',
    'AI',
    'Deployments',
    'Backups',
    'Logs',
    'Metrics',
    'Settings',
  ];

  // eslint-disable-next-line no-restricted-syntax
  for (const linkName of links) {
    const link =
      linkName === 'Settings'
        ? page.getByRole('link', { name: linkName }).first()
        : page.getByRole('link', { name: linkName });
    // eslint-disable-next-line no-await-in-loop
    await expect(link).toBeVisible();
  }
});

test("should show the project's region and subdomain", async ({
  authenticatedNhostPage: page,
}) => {
  await expect(page.locator('p:has-text("Region") + div p').nth(0)).toHaveText(
    /frankfurt \(eu-central-1\)/i,
  );
  await expect(
    page.locator('p:has-text("Subdomain") + div p').nth(0),
  ).toHaveText(/[a-z]{20}/i);
});

test('should not have a GitHub repository connected', async ({
  authenticatedNhostPage: page,
}) => {
  await expect(
    page.getByRole('button', { name: /connect to github/i }).first(),
  ).toBeVisible();
});
