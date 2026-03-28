import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';

const metadataRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/graphql/metadata`;

test('should reload metadata and show consistent status', async ({
  authenticatedNhostPage: page,
}) => {
  await page.goto(metadataRoute);
  await page.waitForURL(metadataRoute);

  await expect(page.getByText(/metadata status/i)).toBeVisible();
  await expect(page.getByText('Consistent', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /reload metadata/i }).click();

  await page.waitForSelector('div:has-text("Metadata reloaded successfully.")');

  await expect(page.getByText(/all metadata is consistent/i)).toBeVisible();
});
