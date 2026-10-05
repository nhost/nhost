import { expect, type Page, test } from '@playwright/test';

async function setUuidOsspInstalled(page: Page, installed: boolean) {
  const action = installed ? 'install' : 'uninstall';
  const dialog = page.getByRole(installed ? 'dialog' : 'alertdialog');
  const row = page
    .getByRole('region', { name: 'All extensions' })
    .getByTestId('extension-row-uuid-ossp');

  await row.getByTestId(`${action}-extension-uuid-ossp`).click();
  const migration = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      new URL(candidate.url()).pathname.endsWith('/apis/migrate'),
  );
  await dialog.getByTestId(`confirm-${action}-extension`).click();
  const response = await migration;

  await expect(dialog).toBeHidden();
  await expect(
    row.getByText(installed ? 'Installed' : 'Available', { exact: true }),
  ).toBeVisible();

  return response;
}

test.describe('Local Dashboard CLI e2e tests', () => {
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

  test('should record extension installs and uninstalls as migrations', async ({
    page,
  }) => {
    await page.goto(
      'https://local.dashboard.local.nhost.run/orgs/local/projects/local/database/extensions/default',
    );
    const extensions = page.getByRole('region', { name: 'All extensions' });
    await expect(extensions).toBeVisible();

    // A retried run can start with the extension still installed.
    if (
      await extensions.getByTestId('uninstall-extension-uuid-ossp').isVisible()
    ) {
      await setUuidOsspInstalled(page, false);
    }

    const install = await setUuidOsspInstalled(page, true);
    expect(install.status()).toBe(200);
    expect(install.request().postDataJSON().name).toBe(
      'create_extension_uuid_ossp',
    );

    const uninstall = await setUuidOsspInstalled(page, false);
    expect(uninstall.status()).toBe(200);
    expect(uninstall.request().postDataJSON().name).toBe(
      'drop_extension_uuid_ossp',
    );
  });
});
