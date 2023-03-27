import {
  TEST_DASHBOARD_URL,
  TEST_PROJECT_ADMIN_SECRET,
  TEST_PROJECT_NAME,
  TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { openProject } from '@/e2e/utils';
import { chromium } from '@playwright/test';

async function globalTeardown() {
  const browser = await chromium.launch();

  const context = await browser.newContext({
    baseURL: TEST_DASHBOARD_URL,
    storageState: 'storageState.json',
  });

  const page = await context.newPage();

  await page.goto('/');

  await openProject({
    page,
    projectName: TEST_PROJECT_NAME,
    workspaceSlug: TEST_WORKSPACE_SLUG,
    projectSlug: TEST_PROJECT_SLUG,
  });

  const pagePromise = context.waitForEvent('page');

  await page.getByRole('link', { name: /hasura/i }).click();
  await page.getByRole('link', { name: /open hasura/i }).click();

  const hasuraPage = await pagePromise;
  await hasuraPage.waitForLoadState();

  const adminSecretInput = hasuraPage.getByPlaceholder(/enter admin-secret/i);

  // paste from clipboard
  await adminSecretInput.fill(TEST_PROJECT_ADMIN_SECRET);
  await adminSecretInput.press('Enter');

  // note: getByRole doesn't work here
  await hasuraPage.locator('a', { hasText: /data/i }).click();
  await hasuraPage.getByRole('link', { name: /sql/i }).click();

  await hasuraPage.getByRole('textbox').fill(`
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

  await hasuraPage.getByRole('button', { name: /run!/i }).click();
  await hasuraPage.getByText(/sql executed!/i).waitFor();
}

export default globalTeardown;
