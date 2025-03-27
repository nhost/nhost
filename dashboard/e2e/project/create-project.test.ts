import { TEST_PERSONAL_ORG_SLUG } from '@/e2e/env';
import { expect, test } from '@/e2e/fixtures/auth-hook';
import { gotoUrl } from '@/e2e/utils';

test.beforeEach(async ({ authenticatedNhostPage: page }) => {
  await gotoUrl(page, `/orgs/${TEST_PERSONAL_ORG_SLUG}/projects`);
});

test.only('should create a new project', async ({
  authenticatedNhostPage: page,
}) => {
  const welcomeMessage = await page.getByText('Welcome to Nhost!');
  await expect(welcomeMessage).toBeVisible();
  await page.getByText('Create your first project').click();

  await page.waitForURL(`/orgs/${TEST_PERSONAL_ORG_SLUG}/projects/new`, {
    waitUntil: 'networkidle',
  });

  await page.getByLabel('Project Name').fill('My First Project');
  await page.getByText('Create Project').click();

  expect(await page.getByText('Creating the project...')).toBeVisible();
  expect(await page.getByText('Internal info')).toBeVisible();
  await page.waitForSelector('button:has-text("Upgrade project")');
});
