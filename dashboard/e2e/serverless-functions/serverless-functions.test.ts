import {
  TEST_ORGANIZATION_SLUG,
  TEST_PROJECT_REMOTE_SCHEMA_NAME,
  TEST_PROJECT_SUBDOMAIN,
} from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';

const functionsRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/functions`;
const functionDetailRoute = `${functionsRoute}/${TEST_PROJECT_REMOTE_SCHEMA_NAME}`;

test.describe('execute serverless function', () => {
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
