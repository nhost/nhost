import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import {
  cleanupOnboardingTestIfNeeded,
  deleteOrganization,
  fillStripeCheckout,
  getOrgSlugFromUrl,
  gotoOrgPageViaSwitcher,
  gotoUrl,
  loginWithFreeUser,
  selectOrgByName,
} from '@/e2e/utils';

let page: Page;

function generateOrganizationName() {
  return faker.lorem.words(3).slice(0, 32);
}

test.beforeAll(async ({ browser }) => {
  await cleanupOnboardingTestIfNeeded();

  page = await browser.newPage();
  await loginWithFreeUser(page);
});

test('user should be able to finish onboarding', async () => {
  await gotoUrl(page, '/onboarding');
  await expect(
    page.getByRole('heading', { name: 'Welcome to Nhost!' }),
  ).toBeVisible();

  const organizationName = generateOrganizationName();

  await page.getByLabel('Organization Name').fill(organizationName);

  await page.getByLabel(/describe your organization/i).click();
  await page.getByRole('option', { name: 'Personal Project' }).click();

  await page.getByText('Pro', { exact: true }).click();

  await page.getByRole('button', { name: 'Create Organization' }).click();

  await fillStripeCheckout(page);

  await page.waitForURL('**/onboarding/project', { timeout: 60000 });
  await expect(
    page.getByRole('heading', { name: 'Create Your First Project' }),
  ).toBeVisible({ timeout: 30000 });

  const projectName = generateOrganizationName();
  await page.getByLabel('Project Name').fill(projectName);

  await page.getByRole('button', { name: 'Create Project' }).click();

  await expect(page.getByText('Project created successfully!')).toBeVisible({
    timeout: 30000,
  });

  await expect(page.getByText('Internal info')).toBeVisible();

  await expect(
    page.getByRole('heading', { name: 'Project Health' }),
  ).toBeVisible({ timeout: 180000 });
});

test('should delete the new organization', async () => {
  const newOrgSlug = getOrgSlugFromUrl(page.url());
  await deleteOrganization(page, newOrgSlug);
});

test('should be able to upgrade an organization', async () => {
  await gotoUrl(page, '/onboarding');
  await expect(
    page.getByRole('heading', { name: 'Welcome to Nhost!' }),
  ).toBeVisible();

  const organizationName = generateOrganizationName();

  await page.getByLabel('Organization Name').fill(organizationName);

  await page.getByLabel(/describe your organization/i).click();
  await page.getByRole('option', { name: 'Personal Project' }).click();

  await page.getByRole('button', { name: 'Create Organization' }).click();

  await expect(
    page.getByText('Organization created successfully!'),
  ).toBeVisible({ timeout: 30000 });

  await gotoUrl(page, '/', { expectRedirect: true });
  const newOrgSlug = await selectOrgByName(page, organizationName);

  await gotoOrgPageViaSwitcher(page, 'Billing');
  await page.waitForURL(`**/orgs/${newOrgSlug}/billing`);

  await expect(
    page.getByRole('heading', { name: 'Subscription plan' }),
  ).toBeVisible();

  const upgradeButton = page.getByRole('button', { name: 'Upgrade' });
  await expect(upgradeButton).toBeEnabled();
  await upgradeButton.click();

  await expect(
    page.getByRole('heading', { name: /upgrade organization/i }),
  ).toBeVisible();

  await page.getByText('Pro', { exact: true }).click();

  await page.getByTestId('upgradeOrgSubmitButton').click();
  await expect(page.getByTestId('upgradeOrgSubmitButton')).toBeHidden();

  await fillStripeCheckout(page);

  await expect(page.getByTestId('message')).toHaveText(
    'Upgrading organization',
  );

  await expect(page.getByTestId('message')).toBeHidden({ timeout: 60000 });
  await expect(page.getByText('Spending Notifications')).toBeVisible({
    timeout: 30000,
  });

  await deleteOrganization(page, newOrgSlug);
});
