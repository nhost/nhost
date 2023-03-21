import { faker } from '@faker-js/faker'
import type { User } from '@nhost/react'
import type { BrowserContext, Page } from '@playwright/test'
import { mailhogURL } from './config'

/**
 * Returns the user data from the profile page.
 *
 * @param page - The page to get the user data from.
 * @returns The user data.
 */
export async function getUserData(page: Page) {
  const textContent = await page.locator('h1:has-text("User information") + div pre').textContent()
  const userData = textContent ? JSON.parse(textContent) : {}

  return userData as User
}

/**
 * Returns a promise that resolves when the sign up flow is completed.
 *
 * @param page - The page to sign up with.
 */
export async function signUpWithEmailAndPassword({
  page,
  email,
  password
}: {
  page: Page
  email: string
  password: string
}) {
  await page.getByRole('button', { name: /home/i }).click()
  await page.getByRole('link', { name: /sign up/i }).click()
  await page.getByRole('button', { name: /continue with email \+ password/i }).click()
  await page.getByPlaceholder(/first name/i).type(faker.name.firstName())
  await page.getByPlaceholder(/last name/i).type(faker.name.lastName())
  await page.getByPlaceholder(/email address/i).type(email)
  await page.getByPlaceholder(/^password$/i).type(password)
  await page.getByPlaceholder(/confirm password/i).type(password)
  await page.getByRole('button', { name: /continue with email \+ password/i }).click()
}

/**
 * Returns a promise that resolves to a new page that is opened after clicking
 * the magic link in the email.
 *
 * @param email - The email address to reset the password for.
 * @param context - The browser context.
 * @returns A promise that resolves to a new page.
 */
export async function verifyMagicLink({
  email,
  context
}: {
  email: string
  context: BrowserContext
}) {
  const mailhogPage = await context.newPage()
  await mailhogPage.goto(mailhogURL)
  await mailhogPage.locator('.messages > .msglist-message', { hasText: email }).nth(0).click()

  // Based on: https://playwright.dev/docs/pages#handling-new-pages
  const authenticatedPagePromise = context.waitForEvent('page')

  await mailhogPage
    .frameLocator('#preview-html')
    .getByRole('link', { name: /sign in/i })
    .click()

  const authenticatedPage = await authenticatedPagePromise
  await authenticatedPage.waitForLoadState()

  return authenticatedPage
}

/**
 * Returns a promise that resolves to a new page that is opened after clicking
 * the reset password link in the email.
 *
 * @param email - The email address to reset the password for.
 * @param context - The browser context.
 * @returns A promise that resolves to a new page.
 */
export async function resetPassword({
  email,
  context
}: {
  email: string
  context: BrowserContext
}) {
  const mailhogPage = await context.newPage()
  await mailhogPage.goto(mailhogURL)
  await mailhogPage.locator('.messages > .msglist-message', { hasText: email }).nth(0).click()

  // Based on: https://playwright.dev/docs/pages#handling-new-pages
  const authenticatedPagePromise = context.waitForEvent('page')

  await mailhogPage
    .frameLocator('#preview-html')
    .getByRole('link', { name: /reset password/i })
    .click()

  const authenticatedPage = await authenticatedPagePromise
  await authenticatedPage.waitForLoadState()

  return authenticatedPage
}

/**
 * Returns a promise that resolves to a new page that is opened after clicking
 * the verify email link in the email.
 *
 * @param email - The email address to verify.
 * @param context - The browser context.
 * @returns A promise that resolves to a new page.
 */
export async function verifyEmail({ email, context }: { email: string; context: BrowserContext }) {
  const mailhogPage = await context.newPage()
  await mailhogPage.goto(mailhogURL)
  await mailhogPage.locator('.messages > .msglist-message', { hasText: email }).nth(0).click()

  // Based on: https://playwright.dev/docs/pages#handling-new-pages
  const authenticatedPagePromise = context.waitForEvent('page')

  await mailhogPage
    .frameLocator('#preview-html')
    .getByRole('link', { name: /verify email/i })
    .click()

  const authenticatedPage = await authenticatedPagePromise
  await authenticatedPage.waitForLoadState()

  return authenticatedPage
}
