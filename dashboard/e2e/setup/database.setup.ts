import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test as setup } from '@/e2e/fixtures/auth-hook';

setup.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

setup(
  'clean up database tables',
  async ({ authenticatedNhostPage: page }) => {
    await page.getByRole('link', { name: /sql editor/i }).click();

    await page.waitForURL(
      `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default/editor`,
    );

    const inputField = page.locator('[contenteditable]');
    await inputField.fill(`
      DO $$ DECLARE
        tablename text;
      BEGIN
        FOR tablename IN
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    await page.locator('button[type="button"]', { hasText: /run/i }).click();
    await expect(page.getByText(/success/i)).toBeVisible();
  },
);
