import { expect, test } from '@playwright/test';

test.describe('Nhost CLI Local Dashboard E2E Tests', () => {
  test('should redirect / to the correct project URL', async ({ page }) => {
    await page.goto('https://local.dashboard.local.nhost.run/');
    await page.waitForURL(
      'https://local.dashboard.local.nhost.run/orgs/local/projects/local',
    );
    expect(page.url()).toBe(
      'https://local.dashboard.local.nhost.run/orgs/local/projects/local',
    );
  });

  test('should load the project URL correctly', async ({ page }) => {
    const projectUrl =
      'https://local.dashboard.local.nhost.run/orgs/local/projects/local';
    await page.goto(projectUrl);
    await expect(page).toHaveURL(projectUrl);
    await expect(page.getByText(/Subdomain/i)).toBeVisible();
  });
});
