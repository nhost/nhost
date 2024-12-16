import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { signUpWithEmailAndPassword, verifyEmail } from '../utils'

test('should be able to change email', async ({ page, browser }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /profile/i }).click()

  const newEmail = faker.internet.email()

  await newPage.getByPlaceholder(/new email/i).fill(newEmail)

  await newPage
    .locator('div')
    .filter({ hasText: /^Change emailChange$/ })
    .getByRole('button')
    .click()

  await expect(
    newPage.getByText('Please check your inbox and follow the link to confirm the email change.')
  ).toBeVisible()

  await newPage.getByRole('link', { name: /sign out/i }).click()

  const mailhogPage = await browser.newPage()

  const updatedEmailPage = await verifyEmail({
    page: mailhogPage,
    email: newEmail,
    context: mailhogPage.context(),
    linkText: /change email/i,
    requestType: 'email-confirm-change'
  })

  await expect(updatedEmailPage.getByRole('heading', { name: /profile/i })).toBeVisible()
})

test('should not accept an invalid email', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /profile/i }).click()

  const newEmail = faker.random.alphaNumeric()

  await newPage.getByPlaceholder(/new email/i).fill(newEmail)

  await newPage
    .locator('div')
    .filter({ hasText: /^Change emailChange$/ })
    .getByRole('button')
    .click()

  await expect(newPage.getByText(/email is incorrectly formatted/i)).toBeVisible()
})
