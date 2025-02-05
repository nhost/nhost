import {
  TEST_DASHBOARD_URL,
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_ADMIN_SECRET,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { navigateToProject } from '@/e2e/utils';
import { test as teardown } from '@playwright/test';

teardown('clean up database tables', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: TEST_DASHBOARD_URL,
    storageState: 'e2e/.auth/user.json',
  });

  const page = await context.newPage();

  try {
    await navigateToProject({
      page,
      orgSlug: TEST_ORGANIZATION_SLUG,
      projectSubdomain: TEST_PROJECT_SUBDOMAIN,
    });

    const pagePromise = context.waitForEvent('page');

    await page.getByRole('link', { name: /hasura/i }).click();
    await page.getByRole('link', { name: /open hasura/i }).click();

    const hasuraPage = await pagePromise;
    await hasuraPage.waitForLoadState();

    const adminSecretInput = hasuraPage.getByPlaceholder(/enter admin-secret/i);
    await adminSecretInput.fill(TEST_PROJECT_ADMIN_SECRET);
    await adminSecretInput.press('Enter');

    const dataTab = hasuraPage.locator('[data-test="data-tab-link"]');
    await dataTab.waitFor({ state: 'visible', timeout: 60000 });
    await dataTab.click();

    await hasuraPage.locator('[data-test="sql-link"]').click();

    await hasuraPage.evaluate(() => {
      const editor = ace.edit('raw_sql');
      editor.setValue(`
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
    });

    await hasuraPage.getByRole('button', { name: /run!/i }).click();
    await hasuraPage.getByText(/sql executed!/i).waitFor();
  } finally {
    await context.close();
  }
});
