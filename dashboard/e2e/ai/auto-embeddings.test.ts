import {
  PRO_TEST_PROJECT_NAME,
  PRO_TEST_PROJECT_SLUG,
  TEST_WORKSPACE_SLUG,
} from '@/e2e/env';
import { openProject } from '@/e2e/utils';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await page.goto('/');

  await openProject({
    page,
    projectName: PRO_TEST_PROJECT_NAME,
    workspaceSlug: TEST_WORKSPACE_SLUG,
    projectSlug: PRO_TEST_PROJECT_SLUG,
  });

  await page
    .getByRole('navigation', { name: /main navigation/i })
    .getByRole('link', { name: /ai/i })
    .click();
});

test.afterAll(async () => {
  await page.close();
});

test('should create and delete an Auto-Embeddings', async () => {
  await page.getByRole('button', { name: 'Add a new Auto-Embeddings' }).click();

  await page.getByLabel('Name').fill('test');
  await page.getByLabel('Schema').fill('auth');
  await page.getByLabel('Table').fill('users');
  await page.getByLabel('Column').fill('email');

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: /test/i })).toBeVisible();

  await page.getByLabel(/more options/i).click();
  await page.getByRole('menuitem', { name: /delete test/i }).click();

  await page.getByLabel('Confirm Delete Auto-').check();
  await page.getByRole('button', { name: 'Delete Auto-Embeddings' }).click();
  await expect(
    page.getByRole('heading', { name: /No Auto-Embeddings are configured/i }),
  ).toBeVisible();
});
