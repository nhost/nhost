import {
  TEST_DASHBOARD_URL,
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { navigateToProject } from '@/e2e/utils';
import { type Page, expect, test as teardown } from '@playwright/test';

let page: Page;

teardown.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: TEST_DASHBOARD_URL,
    storageState: 'e2e/.auth/user.json',
  });

  page = await context.newPage();
});

teardown.beforeEach(async () => {
  await page.goto('/');

  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });

  const databaseRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/database/browser/default`;
  await page.goto(databaseRoute);
  await page.waitForURL(databaseRoute);
});

teardown.afterAll(async () => {
  await page.close();
});

teardown('clean up database tables', async () => {
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
});
