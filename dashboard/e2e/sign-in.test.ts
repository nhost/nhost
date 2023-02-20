import { expect, test } from '@playwright/test';

test('should sign in successfully', async ({ page }) => {
  await page.goto('https://staging.app.nhost.io/');

  expect(page.url()).toBe('https://staging.app.nhost.io/signin');
  await page.locator('text=Continue with Email').click();

  await page.waitForURL('https://staging.app.nhost.io/signin/email');

  await page.fill('input[name="email"]', process.env.NHOST_TEST_USER_EMAIL);
  await page.fill(
    'input[name="password"]',
    process.env.NHOST_TEST_USER_PASSWORD,
  );
  await page.click('button:has-text("Sign In")');

  await page.waitForURL('https://staging.app.nhost.io/');

  expect(await page.locator('h1').textContent()).toBe('My Projects');
});
