import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import {
  getUserData,
  signInAnonymously,
  signUpWithEmailAndPassword,
  signUpWithEmailPasswordless,
  verifyEmail,
  verifyMagicLink
} from '../utils'

test('should deanonymize with email and password', async ({ page, context }) => {
  const email = faker.internet.email()
  const password = faker.internet.password(8)

  await page.goto('/')

  await signInAnonymously({ page })
  await page.getByRole('link', { name: /profile/i }).click()

  const userData = await getUserData(page)

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const authenticatedPage = await verifyEmail({ page, context, email })
  await authenticatedPage.getByRole('link', { name: /profile/i }).click()

  const updatedUserData = await getUserData(authenticatedPage)
  expect(updatedUserData.id).toBe(userData.id)
  expect(updatedUserData.email).toBe(email)
})

test('should deanonymize with a magic link', async ({ page, context }) => {
  const email = faker.internet.email()

  await page.goto('/')

  await signInAnonymously({ page })
  await page.getByRole('link', { name: /profile/i }).click()

  const userData = await getUserData(page)

  await signUpWithEmailPasswordless({ page, email })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const authenticatedPage = await verifyMagicLink({ page, context, email })
  await authenticatedPage.getByRole('link', { name: /profile/i }).click()

  const updatedUserData = await getUserData(authenticatedPage)
  expect(updatedUserData.id).toBe(userData.id)
  expect(updatedUserData.email).toBe(email)
})
