import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const testUrl = process.env.NHOST_TEST_URL;

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();

  await page.goto(testUrl);
  await page
    .getByRole('link', { name: /nhost automation test project/i })
    .click();
  await page.waitForURL(
    `${testUrl}/nhost-automation-test-workspace/nhost-automation-test-project`,
  );
});

test.afterAll(async () => {
  await page.close();
});

test('should show a sidebar with menu items', async () => {
  const navLocator = page.getByRole('navigation', { name: /main navigation/i });
  await expect(navLocator).toBeVisible();
  await expect(navLocator.getByRole('list').getByRole('listitem')).toHaveCount(
    10,
  );
  await expect(navLocator.getByText(/overview/i)).toBeVisible();
  await expect(navLocator.getByText(/database/i)).toBeVisible();
  await expect(navLocator.getByText(/graphql/i)).toBeVisible();
  await expect(navLocator.getByText(/hasura/i)).toBeVisible();
  await expect(navLocator.getByText(/auth/i)).toBeVisible();
  await expect(navLocator.getByText(/storage/i)).toBeVisible();
  await expect(navLocator.getByText(/deployments/i)).toBeVisible();
  await expect(navLocator.getByText(/backups/i)).toBeVisible();
  await expect(navLocator.getByText(/logs/i)).toBeVisible();
  await expect(navLocator.getByText(/settings/i)).toBeVisible();
});

test('should show a header with a logo, the workspace name, and the project name', async () => {
  await expect(
    page
      .getByRole('banner')
      .getByRole('link', { name: /nhost automation test workspace/i }),
  ).toBeVisible();

  await expect(
    page
      .getByRole('banner')
      .getByRole('link', { name: /nhost automation test project/i }),
  ).toBeVisible();
});

test("should show the project's name, the Upgrade button and the Settings button", async () => {
  await expect(
    page.getByRole('heading', { name: /nhost automation test project/i }),
  ).toBeVisible();
  await expect(page.getByText(/free plan/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /upgrade/i })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: /settings/i }),
  ).toBeVisible();
});

test("should show the project's region and subdomain", async () => {
  await expect(page.getByText('Frankfurt (eu-central-1)')).toBeVisible();
  await expect(page.getByText('opilfmysdgrreaslqvlb')).toBeVisible();
});

test('should not have a GitHub repository connected', async () => {
  await expect(
    page.getByRole('button', { name: /connect to github/i }),
  ).toBeVisible();
});

// TODO: Add tests to check the Usage section (needs some UI changes)
