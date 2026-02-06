import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { snakeCase } from 'snake-case';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';

const eventTriggersRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/events/event-triggers`;

async function fillBasicFields({
  page,
  triggerName,
}: {
  page: Page;
  triggerName: string;
}) {
  await page.getByPlaceholder('trigger_name').fill(triggerName);

  await page.getByLabel('Data Source').click();
  await page.getByRole('option', { name: 'default' }).click();

  await page.getByLabel('Schema').click();
  await page.getByRole('option', { name: 'auth' }).click();

  await page.getByLabel('Table').click();
  await page.getByRole('option', { name: 'users' }).click();

  await page.getByLabel('insert').check();

  await page
    .getByPlaceholder(/httpbin\.org/i)
    .fill(
      `https://${TEST_PROJECT_SUBDOMAIN}.hasura.eu-central-1.staging.nhost.run/healthz`,
    );
}

async function deleteEventTrigger({
  page,
  triggerName,
}: {
  page: Page;
  triggerName: string;
}) {
  await page.getByTestId(`event-trigger-menu-${triggerName}`).click();
  await page.getByRole('menuitem', { name: /delete event trigger/i }).click();

  await expect(
    page.getByRole('heading', { name: /delete event trigger/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^delete$/i }).click();

  await page.waitForSelector(
    'div:has-text("Event trigger deleted successfully.")',
  );

  await page.waitForURL(eventTriggersRoute);
}

test('should create and delete an event trigger with transforms', async ({
  authenticatedNhostPage: page,
}) => {
  await page.goto(eventTriggersRoute);
  await page.waitForURL(eventTriggersRoute);

  const triggerName = snakeCase(`e2e ${faker.lorem.words(2)}`);

  await page.getByRole('button', { name: /create event trigger/i }).click();
  await expect(page.getByText(/create a new event trigger/i)).toBeVisible();

  await fillBasicFields({ page, triggerName });

  await page.getByText('Retry and Headers Settings').click();

  await page.getByPlaceholder(/number of retries/i).fill('3');
  await page.getByPlaceholder(/retry interval/i).fill('15');
  await page.getByPlaceholder(/timeout.*60/i).fill('30');

  await page.getByTestId('add-header-button').click();
  await page.getByPlaceholder('Header name').fill('X-Custom-Header');
  await page.getByPlaceholder('Header value').fill('test-value');

  await page.getByText('Configure Transformation').click();

  await page.getByLabel('Request Options Transform').check();
  await page.getByLabel('PUT').click();
  await page.getByPlaceholder(/url template/i).fill('/api/webhook');

  await page.getByLabel('Payload Transform').check();

  await page.getByRole('button', { name: /^create$/i }).click();

  await page.waitForURL(`${eventTriggersRoute}/${triggerName}`);
  await page.waitForSelector(
    'div:has-text("The event trigger has been created successfully.")',
  );

  await deleteEventTrigger({ page, triggerName });
});
