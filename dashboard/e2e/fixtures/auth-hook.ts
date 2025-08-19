import { TEST_DASHBOARD_URL, TEST_PERSONAL_ORG_SLUG } from '@/e2e/env';
import { type Page, test as base } from '@playwright/test';

export const AUTH_CONTEXT = 'e2e/.auth/user.json';

export const test = base.extend<{ authenticatedNhostPage: Page }>({
  authenticatedNhostPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_CONTEXT });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL(
      `${TEST_DASHBOARD_URL}/orgs/${TEST_PERSONAL_ORG_SLUG}/projects`,
      { waitUntil: 'load' },
    );
    await use(page);
    // update the context to get the new refresh token
    await page.waitForLoadState('load');
    await page.context().storageState({ path: AUTH_CONTEXT });
    await page.close();
  },
});

export { expect } from '@playwright/test';
