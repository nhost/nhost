import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { signUpWithEmailAndPassword, verifyEmail } from '../utils'

test('should sign up with email and password', async ({ page, context }) => {
  page.goto('/')

  const email = faker.internet.email()
  const password = faker.internet.password()

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const authenticatedPage = await verifyEmail({ page, context, email })
  await expect(authenticatedPage.getByText(/you are authenticated/i)).toBeVisible()
})

test('should raise an error when trying to sign up with an existing email', async ({ page }) => {
  await page.goto('/')

  const email = faker.internet.email()
  const password = faker.internet.password()

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  // close modal
  await page.getByRole('dialog').getByRole('button').click()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/email already in use/i)).toBeVisible()
})

test('should fail when network is not available', async ({ page }) => {
  await page.goto('/')

  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.route('**', (route) => route.abort('internetdisconnected'))
  await signUpWithEmailAndPassword({ page, email, password })

  await expect(page.getByText(/network error/i)).toBeVisible()
})
