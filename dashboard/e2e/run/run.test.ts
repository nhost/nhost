import { faker } from '@faker-js/faker';
import { TEST_ORGANIZATION_SLUG, TEST_PROJECT_SUBDOMAIN } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { cleanupRunServiceTestIfNeeded } from '@/e2e/utils';

test.beforeAll(async () => {
  await cleanupRunServiceTestIfNeeded();
});

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  const runRoute = `/orgs/${TEST_ORGANIZATION_SLUG}/projects/${TEST_PROJECT_SUBDOMAIN}/run`;
  await page.goto(runRoute);
  await page.waitForURL(runRoute);
});

test('should create and delete a run service', async ({
  authenticatedNhostPage: page,
}) => {
  // Unique, e2e-scoped name so this test never collides with parallel runs or
  // leftover services from a cancelled run, and so its assertions only ever
  // match the service it created (not the project's global service list).
  const serviceName = `e2e-run-${faker.lorem.slug(2)}`;

  await page.getByRole('button', { name: 'Add service' }).first().click();
  await expect(page.getByText(/create a new service/i)).toBeVisible();
  await page.getByPlaceholder(/service name/i).click();
  await page.getByPlaceholder(/service name/i).fill(serviceName);

  await page.getByText('Nhost registry').click();
  await page.getByPlaceholder('Replicas').click();
  await page.getByPlaceholder('Replicas').fill('0');

  await page.getByRole('button', { name: /create/i }).click();

  await expect(
    page.getByRole('heading', { name: /confirm resources/i }),
  ).toBeVisible();

  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(
    page.getByText('The service has been configured successfully.'),
  ).toBeVisible({ timeout: 30000 });

  await expect(page.getByRole('heading', { name: serviceName })).toBeVisible();

  await page.getByLabel(/more options/i).click();

  await page.getByRole('menuitem', { name: /delete service/i }).click();

  await page.getByLabel(/confirm delete project #/i).check();

  await page.getByRole('button', { name: /delete service/i }).click();

  // Scoped to the unique service name so it passes regardless of other
  // services present (parallel runs / leftovers), instead of asserting the
  // whole project's service list is empty.
  await expect(page.getByRole('main').getByText(serviceName)).toHaveCount(0);
});
