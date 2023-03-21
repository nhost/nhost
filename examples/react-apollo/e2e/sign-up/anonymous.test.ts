import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { baseURL } from '../config'
import {
  getUserData,
  signUpWithEmailAndPassword,
  signUpWithEmailPasswordless,
  verifyEmail,
  verifyMagicLink
} from '../utils'

test('should deanonymize with email and password', async ({ page, context }) => {
  await page.goto(`${baseURL}/sign-in`)
  await page.getByRole('link', { name: /sign in anonymously/i }).click()
  await page.waitForURL(baseURL)
  await page.getByRole('button', { name: /profile/i }).click()

  const userData = await getUserData(page)
  const email = faker.internet.email()
  const password = faker.internet.password(8)

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const authenticatedPage = await verifyEmail({ page, context, email })
  await authenticatedPage.getByRole('button', { name: /profile/i }).click()

  const updatedUserData = await getUserData(authenticatedPage)
  expect(updatedUserData.id).toBe(userData.id)
  expect(updatedUserData.email).toBe(email)
})

test('should deanonymize with a magic link', async ({ page, context }) => {
  await page.goto(`${baseURL}/sign-in`)
  await page.getByRole('link', { name: /sign in anonymously/i }).click()
  await page.waitForURL(baseURL)
  await page.getByRole('button', { name: /profile/i }).click()

  const userData = await getUserData(page)
  const email = faker.internet.email()

  await signUpWithEmailPasswordless({ page, email })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const authenticatedPage = await verifyMagicLink({ page, context, email })
  await authenticatedPage.getByRole('button', { name: /profile/i }).click()

  const updatedUserData = await getUserData(authenticatedPage)
  expect(updatedUserData.id).toBe(userData.id)
  expect(updatedUserData.email).toBe(email)
})
