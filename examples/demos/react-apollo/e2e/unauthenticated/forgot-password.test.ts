import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { baseURL } from '../config'
import { resetPassword, signUpWithEmailAndPassword } from '../utils'

test('should reset password', async ({ page, context }) => {
  await page.goto('/')

  const email = faker.internet.email()
  const password = faker.internet.password(8)

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  await page.goto(`${baseURL}/sign-in`)
  await page.getByRole('link', { name: /continue with email \+ password/i }).click()
  await page.getByRole('link', { name: /forgot password?/i }).click()

  await page.getByPlaceholder('email').type(email)
  await page.getByRole('button', { name: /reset your password/i }).click()

  const authenticatedPage = await resetPassword({ page, context, email })

  await authenticatedPage.waitForLoadState()
  await authenticatedPage.getByRole('link', { name: /profile/i }).click()

  await expect(authenticatedPage.getByRole('heading', { name: 'Profile' })).toBeVisible()
})
