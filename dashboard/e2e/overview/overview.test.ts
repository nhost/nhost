import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { navigateToProject } from '../utils';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();

  await page.goto('/');

  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });
});

test.afterAll(async () => {
  await page.close();
});

test('should show the navtree with all links visible', async () => {
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

  for (const linkName of links) {
    const link =
      linkName === 'Settings'
        ? page.getByRole('link', { name: linkName }).first()
        : page.getByRole('link', { name: linkName });
    await expect(link).toBeVisible();
  }
});

test("should show the project's region and subdomain", async () => {
  await expect(page.locator('p:has-text("Region") + div p').nth(0)).toHaveText(
    /frankfurt \(eu-central-1\)/i,
  );
  await expect(
    page.locator('p:has-text("Subdomain") + div p').nth(0),
  ).toHaveText(/[a-z]{20}/i);
});

test('should not have a GitHub repository connected', async () => {
  await expect(
    page.getByRole('button', { name: /connect to github/i }).first(),
  ).toBeVisible();
});
