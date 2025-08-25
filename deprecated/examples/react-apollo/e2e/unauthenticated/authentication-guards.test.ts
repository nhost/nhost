import { expect, test } from '@playwright/test'
import { baseURL } from '../config'

test('should redirect to /sign-in when not authenticated', async ({ page }) => {
  await page.goto(`${baseURL}`)
  await page.waitForURL(`${baseURL}/sign-in`)

  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

  await page.goto(`${baseURL}/todos`)
  await page.waitForURL(`${baseURL}/sign-in`)

  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
})
