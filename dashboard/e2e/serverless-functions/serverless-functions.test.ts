import {
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_REMOTE_SCHEMA_NAME,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';

const functionsRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/functions`;
const functionDetailRoute = `${functionsRoute}/${TEST_PROJECT_REMOTE_SCHEMA_NAME}`;

test.describe('serverless functions', () => {
  test.describe('index page', () => {
    test.beforeEach(async ({ authenticatedNhostPage: page }) => {
      await page.goto(functionsRoute);
      await page.waitForURL(functionsRoute);
    });

    test('should show Functions link in navigation tree', async ({
      authenticatedNhostPage: page,
    }) => {
      const navLocator = page.getByLabel('Navigation Tree');
      await expect(navLocator).toBeVisible();
      await expect(
        navLocator.getByRole('link', { name: 'Functions' }),
      ).toBeVisible();
    });

    test('should show sidebar with functions listed', async ({
      authenticatedNhostPage: page,
    }) => {
      await expect(
        page.getByText(TEST_PROJECT_REMOTE_SCHEMA_NAME).first(),
      ).toBeVisible();
    });

    test('should show prompt to select a function on index page', async ({
      authenticatedNhostPage: page,
    }) => {
      await expect(
        page.getByText('Select a function from the sidebar to get started.'),
      ).toBeVisible();
    });
  });

  test.describe('function detail - overview tab', () => {
    test.beforeEach(async ({ authenticatedNhostPage: page }) => {
      await page.goto(functionDetailRoute);
      await page.waitForURL(functionDetailRoute);
    });

    test('should show function route and file path', async ({
      authenticatedNhostPage: page,
    }) => {
      await expect(
        page.getByRole('heading', {
          name: `/${TEST_PROJECT_REMOTE_SCHEMA_NAME}`,
        }),
      ).toBeVisible();
      await expect(
        page
          .getByText(`functions/${TEST_PROJECT_REMOTE_SCHEMA_NAME}.ts`)
          .first(),
      ).toBeVisible();
    });

    test('should show endpoint URL with copy button', async ({
      authenticatedNhostPage: page,
    }) => {
      await expect(
        page
          .getByText(new RegExp(`${TEST_PROJECT_REMOTE_SCHEMA_NAME}`))
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByRole('button', {
            name: new RegExp(TEST_PROJECT_REMOTE_SCHEMA_NAME),
          })
          .first(),
      ).toBeVisible();
    });

    test('should show runtime and deployment metadata', async ({
      authenticatedNhostPage: page,
    }) => {
      await expect(page.getByText('nodejs22.x')).toBeVisible();
      await expect(page.getByText('Commit')).toBeVisible();
    });

    test('should show timestamps', async ({ authenticatedNhostPage: page }) => {
      await expect(page.getByText('Created')).toBeVisible();
      await expect(page.getByText('Updated')).toBeVisible();
    });
  });

  test.describe('execute tab', () => {
    test.beforeEach(async ({ authenticatedNhostPage: page }) => {
      await page.goto(functionDetailRoute);
      await page.waitForURL(functionDetailRoute);
      await page.getByRole('tab', { name: 'Execute' }).click();
    });

    test('should send a GET request with query param and custom header, and display response', async ({
      authenticatedNhostPage: page,
    }) => {
      await page.getByRole('button', { name: /add row/i }).click();
      await page.getByPlaceholder('Header name').last().fill('Accept');
      await page
        .getByPlaceholder('Header value')
        .last()
        .fill('application/graphql-response+json');

      await page.getByRole('tab', { name: 'Params' }).click();
      await page.getByRole('button', { name: /add row/i }).click();
      await page.getByPlaceholder('Param name').fill('query');
      await page.getByPlaceholder('Param value').fill('{__typename}');

      await page.getByRole('button', { name: 'Send' }).click();

      await expect(page.getByText(/200 OK/)).toBeVisible();
      await expect(
        page.locator('pre').filter({ hasText: '__typename' }),
      ).toBeVisible();

      await page.getByRole('tab', { name: 'Headers' }).last().click();
      await expect(page.getByText('content-type:')).toBeVisible();
      await expect(
        page.getByText('application/graphql-response+json'),
      ).toBeVisible();
    });

    test('should send a POST request with a JSON body and display the response', async ({
      authenticatedNhostPage: page,
    }) => {
      await page.getByRole('combobox').filter({ hasText: 'GET' }).click();
      await page.getByRole('option', { name: 'POST' }).click();

      await page.getByRole('tab', { name: 'Request' }).click();
      await page
        .getByPlaceholder('{\n  "key": "value"\n}')
        .fill('{"query":"{__typename}"}');

      await page.getByRole('button', { name: 'Send' }).click();

      await expect(page.getByText(/200 OK/)).toBeVisible();
      await expect(
        page.locator('pre').filter({ hasText: '__typename' }),
      ).toBeVisible();

      await page.getByRole('tab', { name: 'Headers' }).last().click();
      const responseHeaders = page
        .getByRole('tabpanel', { name: 'Headers' })
        .last();
      await expect(responseHeaders.getByText('content-type:')).toBeVisible();
      await expect(
        responseHeaders.getByText(/application\/.*json/),
      ).toBeVisible();
    });
  });

  test.describe('logs tab', () => {
    test.beforeEach(async ({ authenticatedNhostPage: page }) => {
      await page.goto(functionDetailRoute);
      await page.waitForURL(functionDetailRoute);
      await page.getByRole('tab', { name: 'Logs' }).click();
    });

    test('should show log search controls and display logs', async ({
      authenticatedNhostPage: page,
    }) => {
      await expect(page.getByRole('button', { name: /search/i })).toBeVisible();

      // Wait for logs to finish loading before checking content
      await expect(page.getByRole('button', { name: /search/i })).toBeEnabled();

      await expect(
        page.getByText('There are no logs for the selected period.'),
      ).not.toBeVisible();
    });
  });

  test('should show "does not exist" for unknown function slug', async ({
    authenticatedNhostPage: page,
  }) => {
    const notFoundRoute = `${functionsRoute}/this_function_does_not_exist`;
    await page.goto(notFoundRoute);
    await page.waitForURL(notFoundRoute);

    await expect(page.getByText('does not exist')).toBeVisible();
  });
});
