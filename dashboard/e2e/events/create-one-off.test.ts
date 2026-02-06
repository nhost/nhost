import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';

const oneOffsRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/events/one-offs`;

async function fillBasicFields({
  page,
  comment,
}: {
  page: Page;
  comment: string;
}) {
  await page
    .getByPlaceholder(/describe the scheduled event/i)
    .fill(comment);

  await page
    .getByPlaceholder(/httpbin\.org/i)
    .fill(
      `https://${TEST_PROJECT_SUBDOMAIN}.hasura.eu-central-1.staging.nhost.run/healthz`,
    );

  await page.getByPlaceholder(/John Doe/i).fill('{"key": "value"}');
}

async function deleteOneOff({
  page,
  comment,
}: {
  page: Page;
  comment: string;
}) {
  const row = page.locator('tr', { hasText: comment });
  await row.getByTestId('delete-scheduled-event').click();

  await page.waitForSelector(
    'div:has-text("Scheduled event deleted successfully.")',
  );
}

test('should create and delete a one-off scheduled event', async ({
  authenticatedNhostPage: page,
}) => {
  await page.goto(oneOffsRoute);
  await page.waitForURL(oneOffsRoute);

  const comment = `e2e ${faker.lorem.words(3)}`;

  await page.getByRole('button', { name: /new one-off/i }).click();
  await expect(
    page.getByText(/create a new one-off scheduled event/i),
  ).toBeVisible();

  await fillBasicFields({ page, comment });

  await page.getByText('Retry and Headers Settings').click();

  await page.getByPlaceholder(/number of retries/i).fill('3');
  await page.getByPlaceholder(/retry interval/i).fill('15');
  await page.getByPlaceholder(/timeout.*60/i).fill('30');

  await page.getByTestId('add-header-button').click();
  await page.getByPlaceholder('Header name').fill('X-Custom-Header');
  await page.getByPlaceholder('Header value').fill('test-value');

  await page.getByRole('button', { name: /^create$/i }).click();

  await page.waitForSelector(
    'div:has-text("The scheduled event has been created successfully.")',
  );

  await expect(page.locator('tr', { hasText: comment })).toBeVisible();

  await deleteOneOff({ page, comment });
});
