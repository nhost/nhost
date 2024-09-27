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
    .getByRole('link', { name: /run/i })
    .click();
});

test.afterAll(async () => {
  await page.close();
});

test('should create and delete a run service', async () => {
  await page.getByRole('button', { name: 'Add service' }).first().click();
  await expect(page.getByText(/create a new service/i)).toBeVisible();
  await page.getByPlaceholder(/service name/i).click();
  await page.getByPlaceholder(/service name/i).fill('test');

  await page.getByRole('button', { name: /create/i }).click();

  await expect(
    page.getByRole('heading', { name: /confirm resources/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(
    page.getByRole('heading', { name: /service details/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /ok/i }).click();

  await expect(page.getByRole('heading', { name: /test/i })).toBeVisible();

  await page.getByLabel(/more options/i).click();

  await page.getByRole('menuitem', { name: /delete service/i }).click();

  await page.getByLabel(/confirm delete project #/i).check();

  await page.getByRole('button', { name: /delete service/i }).click();

  await expect(
    page
      .getByRole('main')
      .locator('div')
      .filter({ hasText: 'No custom services are' })
      .nth(2),
  ).toBeVisible();
});
