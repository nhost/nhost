import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';

const cronTriggersRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/events/cron-triggers`;

async function fillBasicFields({
  page,
  triggerName,
}: {
  page: Page;
  triggerName: string;
}) {
  await page.getByPlaceholder('cron_trigger_name').fill(triggerName);
  await page
    .getByPlaceholder(/describe the cron trigger/i)
    .fill('E2E test cron trigger');
  await page
    .getByPlaceholder(/httpbin\.org/i)
    .fill(
      `https://${TEST_PROJECT_SUBDOMAIN}.hasura.eu-central-1.staging.nhost.run/healthz`,
    );

  await page.getByPlaceholder('* * * * *').click();
  await page.getByRole('option', { name: /every minute/i }).click();

  await page.getByPlaceholder(/John Doe/i).fill('{"key": "value"}');
}

async function deleteCronTrigger({
  page,
  triggerName,
}: {
  page: Page;
  triggerName: string;
}) {
  await page.getByTestId(`cron-trigger-menu-${triggerName}`).click();
  await page.getByRole('menuitem', { name: /delete cron trigger/i }).click();

  await expect(
    page.getByRole('heading', { name: /delete cron trigger/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^delete$/i }).click();

  await page.waitForSelector(
    'div:has-text("Cron trigger deleted successfully.")',
  );

  await page.waitForURL(cronTriggersRoute);
}

test('should create and delete a cron trigger with transforms', async ({
  authenticatedNhostPage: page,
}) => {
  await page.goto(cronTriggersRoute);
  await page.waitForURL(cronTriggersRoute);

  const triggerName = snakeCase(`e2e ${faker.lorem.words(2)}`);

  await page.getByRole('button', { name: /new cron trigger/i }).click();
  await expect(page.getByText(/create a new cron trigger/i)).toBeVisible();

  await fillBasicFields({ page, triggerName });

  await page.getByText('Retry and Headers Settings').click();

  await page.getByPlaceholder(/number of retries/i).fill('3');
  await page.getByPlaceholder(/retry interval/i).fill('15');
  await page.getByPlaceholder(/timeout.*60/i).fill('30');
  await page.getByPlaceholder(/tolerance/i).fill('3600');

  await page.getByTestId('add-header-button').click();
  await page.getByPlaceholder('Header name').fill('X-Custom-Header');
  await page.getByPlaceholder('Header value').fill('test-value');

  await page.getByText('Request Options').click();

  await page.getByRole('button', { name: /add options transform/i }).click();
  await page.getByLabel('PUT').click();
  await page.getByPlaceholder(/url template/i).fill('/api/webhook');

  await page.getByRole('button', { name: /add payload transform/i }).click();

  await page.getByRole('button', { name: /^create$/i }).click();

  await page.waitForURL(`${cronTriggersRoute}/${triggerName}`);
  await page.waitForSelector(
    'div:has-text("The cron trigger has been created successfully.")',
  );

  await deleteCronTrigger({ page, triggerName });
});
