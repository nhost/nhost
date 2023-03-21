import { expect, test } from '@playwright/test'
import { baseURL } from '../config'

test('should redirect to /sign-in when not authenticated', async ({ page }) => {
  await page.goto(`${baseURL}`)
  await page.waitForURL(`${baseURL}/sign-in`)

  await expect(page.getByText(/sign in to the application/i)).toBeVisible()

  await page.goto(`${baseURL}/apollo`)
  await page.waitForURL(`${baseURL}/sign-in`)

  await expect(page.getByText(/sign in to the application/i)).toBeVisible()
})
