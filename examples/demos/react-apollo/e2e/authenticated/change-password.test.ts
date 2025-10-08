import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { signInWithEmailAndPassword, signUpWithEmailAndPassword, verifyEmail } from '../utils'

test('should be able to change password', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /profile/i }).click()

  const newPassword = faker.internet.password()

  await newPage.getByPlaceholder(/new password/i).fill(newPassword)

  // await newPage.locator('h1:has-text("Change password") + div button:has-text("Change")').click()
  await newPage
    .locator('div')
    .filter({ hasText: /^Change passwordChange$/ })
    .getByRole('button')
    .click()

  await expect(newPage.getByText(/password changed successfully./i)).toBeVisible()

  await newPage.getByRole('link', { name: 'Sign out' }).click()

  await signInWithEmailAndPassword({ page: newPage, email, password: newPassword })
  await expect(newPage.getByText(/you are authenticated/i)).toBeVisible()
})

test('should not accept an invalid email', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /profile/i }).click()

  const newPassword = faker.internet.password(2)

  await newPage.getByPlaceholder(/new password/i).fill(newPassword)
  // await newPage.locator('h1:has-text("Change password") + div button:has-text("Change")').click()

  await newPage
    .locator('div')
    .filter({ hasText: /^Change passwordChange$/ })
    .getByRole('button')
    .click()

  await expect(newPage.getByText(/password is incorrectly formatted/i)).toBeVisible()
})
