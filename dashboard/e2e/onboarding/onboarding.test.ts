import { expect, test } from '@/e2e/fixtures/auth-hook';
import {
  cleanupOnboardingTestIfNeeded,
  getCardExpiration,
  getOrgSlugFromUrl,
  gotoUrl,
  loginWithFreeUser,
} from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  await cleanupOnboardingTestIfNeeded();

  page = await browser.newPage();
  await loginWithFreeUser(page);
});

test('user should be able to finish onboarding', async () => {
  await gotoUrl(page, `/onboarding`);
  await expect(page.getByText('Welcome to Nhost!')).toBeVisible();
  const organizationName = faker.lorem.words(3).slice(0, 32);

  await page.getByLabel('Organization Name').fill(organizationName);
  await page.getByText('Select organization type', { exact: true }).click();
  await page.getByText('Personal Project').nth(1).click();

  await page.getByText('Pro', { exact: true }).click();

  await page.getByText('Create Organization').click();

  const stripeFrame = page
    .frameLocator('iframe[name="embedded-checkout"]')
    .first();
  stripeFrame.getByText('Subscribe to Nhost');
  await stripeFrame.getByLabel('Email').fill(faker.internet.email());

  await stripeFrame
    .getByPlaceholder('1234 1234 1234 1234')
    .fill('4242424242424242');

  await stripeFrame.getByPlaceholder('MM / YY').fill(getCardExpiration());
  await stripeFrame.getByPlaceholder('CVC').fill('123');
  await stripeFrame
    .getByPlaceholder('Full name on card')
    .fill('EndyTo EndyTest');
  await stripeFrame.locator('#billingCountry').scrollIntoViewIfNeeded();
  // Need to comment out for testing outside US START
  // await stripeFrame.getByPlaceholder('Address', { exact: true }).click();
  // stripeFrame.locator('span:has-text("Enter address manually")');
  // await stripeFrame.getByText('Enter address manually').click();
  // await stripeFrame
  //   .getByPlaceholder('Address line 1', { exact: true })
  //   .fill('123 Main Street');
  // await stripeFrame
  //   .getByPlaceholder('City', { exact: true })
  //   .fill('Springfield');
  // await stripeFrame.getByPlaceholder('ZIP', { exact: true }).fill('62701');
  // await stripeFrame.locator('#enableStripePass').click({ force: true });
  // Need to comment out for testing outside US END
  stripeFrame
    .getByTestId('hosted-payment-submit-button')
    .scrollIntoViewIfNeeded();
  await stripeFrame
    .getByTestId('hosted-payment-submit-button')
    .click({ force: true });

  await expect(
    page.getByText('Processing new organization request').first(),
  ).toBeVisible();
  await page.waitForSelector(
    'div:has-text("Organization created successfully. Redirecting...")',
  );

  await expect(page.getByText('Create Your First Project')).toBeVisible();

  const projectName = faker.lorem.words(3).slice(0, 32);
  await page.getByLabel('Project Name').fill(projectName);

  await page.getByText('Create Project', { exact: true }).click();

  await expect(page.getByText('Creating your project...')).toBeVisible();
  await expect(page.getByText('Project created successfully!')).toBeVisible();

  await expect(page.getByText('Internal info')).toBeVisible();

  await page.waitForSelector('h3:has-text("Project Health")', {
    timeout: 180000,
  });
});

test('should delete the new organization', async () => {
  const newOrgSlug = getOrgSlugFromUrl(page.url());
  await gotoUrl(page, `/orgs/${newOrgSlug}/projects`);
  await page.getByRole('link', { name: 'Settings' }).click();

  await page.waitForSelector('h3:has-text("Delete Organization")');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForSelector('h2:has-text("Delete Organization")');
  await expect(page.getByTestId('deleteOrgButton')).toBeDisabled();

  await page.getByLabel("I'm sure I want to delete this Organization").click();
  await expect(page.getByTestId('deleteOrgButton')).toBeDisabled();
  await page.getByLabel('I understand this action cannot be undone').click();
  await expect(page.getByTestId('deleteOrgButton')).not.toBeDisabled();

  await page.getByTestId('deleteOrgButton').click();

  await page.waitForSelector('div:has-text("Deleting the organization")');
  await page.waitForSelector(
    'div:has-text("Successfully deleted the organization")',
  );

  await page.waitForSelector('h2:has-text("Welcome to Nhost!")');
});

test('should be able to upgrade an organization', async () => {
  await gotoUrl(page, `/onboarding`);
  expect(page.getByText('Welcome to Nhost!')).toBeVisible();
  const organizationName = faker.lorem.words(3).slice(0, 32);

  await page.getByLabel('Organization Name').fill(organizationName);
  await page.getByText('Select organization type', { exact: true }).click();
  await page.getByText('Personal Project').nth(1).click();

  await page.getByText('Create Organization').click();

  await page.waitForSelector(
    'div:has-text("Organization created successfully!")',
  );
  await page.getByText('Select organization', { exact: true }).click();
  await page.getByLabel('Organizations').getByText(organizationName).click();

  await page.waitForSelector('h2:has-text("Welcome to Nhost!")');
  await page.getByRole('link', { name: 'Billing' }).click();

  await page.waitForSelector('h4:has-text("Subscription plan")');
  await expect(page.getByText('Upgrade')).toBeEnabled();
  await page.getByText('Upgrade').click();
  await page.waitForSelector('h2:has-text("Upgrade Organization")');

  await page.getByText('Pro', { exact: true }).click();

  await page.getByTestId('upgradeOrgSubmitButton').click();
  await page.waitForSelector('button[data-testid="upgradeOrgSubmitButton"]', {
    state: 'hidden',
  });

  const stripeFrame = page
    .frameLocator('iframe[name="embedded-checkout"]')
    .first();
  stripeFrame
    .locator('div[data-testid="product-summary"]')
    .waitFor({ state: 'visible' });
  await stripeFrame.getByLabel('Email').fill(faker.internet.email());

  await stripeFrame
    .getByPlaceholder('1234 1234 1234 1234')
    .fill('4242424242424242');

  await stripeFrame.getByPlaceholder('MM / YY').fill(getCardExpiration());
  await stripeFrame.getByPlaceholder('CVC').fill('123');
  await stripeFrame
    .getByPlaceholder('Full name on card')
    .fill('EndyTo EndyTest');
  await stripeFrame.locator('#billingCountry').scrollIntoViewIfNeeded();
  // Need to comment out for testing outside US START
  // await stripeFrame.getByPlaceholder('Address', { exact: true }).click();
  // stripeFrame.locator('span:has-text("Enter address manually")');
  // await stripeFrame.getByText('Enter address manually').click();
  // await stripeFrame
  //   .getByPlaceholder('Address line 1', { exact: true })
  //   .fill('123 Main Street');
  // await stripeFrame
  //   .getByPlaceholder('City', { exact: true })
  //   .fill('Springfield');
  // await stripeFrame.getByPlaceholder('ZIP', { exact: true }).fill('62701');
  // await stripeFrame.locator('#enableStripePass').click({ force: true });
  // Need to comment out for testing outside US END
  stripeFrame
    .getByTestId('hosted-payment-submit-button')
    .scrollIntoViewIfNeeded();
  await stripeFrame
    .getByTestId('hosted-payment-submit-button')
    .click({ force: true });
  await page.waitForSelector('div:has-text("Upgrading organization")');
  await page.waitForSelector(
    'div:has-text("Organization has been upgraded successfully.")',
  );
  await page.waitForSelector('span:has-text("Spending Notifications")');

  await page.getByRole('link', { name: 'Settings' }).click();

  await page.waitForSelector('h3:has-text("Delete Organization")');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForSelector('h2:has-text("Delete Organization")');
  await expect(page.getByTestId('deleteOrgButton')).toBeDisabled();

  await page.getByLabel("I'm sure I want to delete this Organization").click();
  await expect(page.getByTestId('deleteOrgButton')).toBeDisabled();
  await page.getByLabel('I understand this action cannot be undone').click();
  await expect(page.getByTestId('deleteOrgButton')).not.toBeDisabled();

  await page.getByTestId('deleteOrgButton').click();

  await page.waitForSelector('div:has-text("Deleting the organization")');
  await page.waitForSelector(
    'div:has-text("Successfully deleted the organization")',
  );

  await page.waitForSelector('h2:has-text("Welcome to Nhost!")');
});
