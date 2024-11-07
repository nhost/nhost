import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { navigateToProject } from '../utils';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.beforeEach(async () => {
  await page.goto('/');

  await navigateToProject({
    page,
    orgSlug: TEST_ORGANIZATION_SLUG,
    projectSubdomain: TEST_PROJECT_SUBDOMAIN,
  });

  const runRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/run`;
  await page.goto(runRoute);
  await page.waitForURL(runRoute);
});

test.afterAll(async () => {
  await page.close();
});

test('should create and delete a run service', async () => {
  await page.getByRole('button', { name: 'Add service' }).first().click();
  await expect(page.getByText(/create a new service/i)).toBeVisible();
  await page.getByPlaceholder(/service name/i).click();
  await page.getByPlaceholder(/service name/i).fill('test');

  await page.getByText('Nhost registry').click();
  await page.getByPlaceholder('Replicas').click();
  await page.getByPlaceholder('Replicas').fill('0');

  await page.getByRole('button', { name: /create/i }).click();

  await expect(
    page.getByRole('heading', { name: /confirm resources/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /confirm/i }).click();

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
