import { expect, test } from '@/e2e/fixtures/auth-hook';
import {
  getCardExpiration,
  getFreeUserStarterOrgSlug,
  getNewOrgSlug,
  getNewProjectName,
  getNewProjectSlug,
  getOrgSlugFromUrl,
  getProjectSlugFromUrl,
  gotoUrl,
  loginWithFreeUser,
  setNewOrgSlug,
  setNewProjectName,
  setNewProjectSlug,
} from '@/e2e/utils';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await loginWithFreeUser(page);
});

test('should create a new project', async () => {
  await gotoUrl(page, `/orgs/${getFreeUserStarterOrgSlug()}/projects/new`);
  const projectName = faker.lorem.words(3).slice(0, 32);

  await page.getByLabel('Project Name').fill(projectName);
  await page.getByText('Create Project').click();

  expect(page.getByText('Creating the project...')).toBeVisible();
  expect(page.getByText('Internal info')).toBeVisible();

  await page.waitForSelector('button:has-text("Upgrade project")', {
    timeout: 180000,
  });

  const newProjectSlug = getProjectSlugFromUrl(page.url());
  setNewProjectSlug(newProjectSlug);
  setNewProjectName(projectName);
});

test('should upgrade the project', async () => {
  await gotoUrl(
    page,
    `/orgs/${getFreeUserStarterOrgSlug()}/projects/${getNewProjectSlug()}`,
  );
  const upgradeProject = page.getByText('Upgrade project');
  expect(upgradeProject).toBeVisible();

  await upgradeProject.click();

  await page.waitForSelector('h2:has-text("Upgrade project")');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('h2:has-text("New Organization")');

  const newOrgName = faker.lorem.words(3);
  await page.getByLabel('Organization Name').fill(newOrgName);

  await page.getByText('Create organization').click();
  await page.waitForSelector('button:has-text("Create organization")', {
    state: 'hidden',
  });
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
  // Need to comment out for local testing START
  await stripeFrame.getByPlaceholder('Address', { exact: true }).click();
  stripeFrame.locator('span:has-text("Enter address manually")');
  await stripeFrame.getByText('Enter address manually').click();
  await stripeFrame
    .getByPlaceholder('Address line 1', { exact: true })
    .fill('123 Main Street');
  await stripeFrame
    .getByPlaceholder('City', { exact: true })
    .fill('Springfield');
  await stripeFrame.getByPlaceholder('ZIP', { exact: true }).fill('62701');
  await stripeFrame.locator('#enableStripePass').click({ force: true });
  // local Comment end
  await stripeFrame
    .getByTestId('hosted-payment-submit-button')
    .scrollIntoViewIfNeeded();
  await stripeFrame
    .getByTestId('hosted-payment-submit-button')
    .click({ force: true });

  await page.waitForSelector('h2:has-text("Upgrade project")');
  await page.waitForSelector(
    'div:has-text("Organization created successfully.")',
  );
  await page.waitForSelector(
    'div:has-text("Project has been upgraded successfully!")',
  );

  page.getByRole('button', { name: 'Create project' });

  await page.waitForSelector(`div:has-text("${newOrgName}")`);
  await page.waitForSelector(`p:has-text("${getNewProjectName()}")`);

  setNewOrgSlug(getOrgSlugFromUrl(page.url()));
});

test('should delete the new organization', async () => {
  await gotoUrl(page, `/orgs/${getNewOrgSlug()}/projects`);
  await page.getByRole('link', { name: 'Settings' }).click();

  await page.waitForSelector('h3:has-text("Delete Organization")');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForSelector('h2:has-text("Delete Organization")');
  expect(page.getByTestId('deleteOrgButton')).toBeDisabled();

  await page.getByLabel("I'm sure I want to delete this Organization").click();
  expect(page.getByTestId('deleteOrgButton')).toBeDisabled();
  await page.getByLabel('I understand this action cannot be undone').click();
  expect(page.getByTestId('deleteOrgButton')).not.toBeDisabled();

  await page.getByTestId('deleteOrgButton').click();

  await page.waitForSelector('div:has-text("Deleting the organization")');
  await page.waitForSelector(
    'div:has-text("Successfully deleted the organization")',
  );

  await page.waitForSelector(`div:has-text("Personal Organization")`);
});
