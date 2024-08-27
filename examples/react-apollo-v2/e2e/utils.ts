import { faker } from '@faker-js/faker'
import type { User } from '@nhost/react'
import type { BrowserContext, Page } from '@playwright/test'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { baseURL, mailhogURL } from './config'

/**
 * Returns the user data from the profile page.
 *
 * @param page - The page to get the user data from.
 * @returns The user data.
 */
export async function getUserData(page: Page) {
  const userInformation = await page.locator('pre').nth(0).textContent()

  const userData = userInformation ? JSON.parse(userInformation) : {}

  return userData as User
}

/**
 * Returns a promise that resolves when the sign up flow is completed.
 *
 * @param page - The page to sign up with.
 * @param email - The email address to sign up with.
 * @param password - The password to sign up with.
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
  await page.getByRole('link', { name: /sign up/i }).click()
  await page.getByRole('link', { name: /continue with email \+ password/i }).click()
  await page.getByPlaceholder(/first name/i).type(faker.name.firstName())
  await page.getByPlaceholder(/last name/i).type(faker.name.lastName())
  await page.getByPlaceholder(/email/i).type(email)
  await page.getByPlaceholder(/^password$/i).type(password)
  await page.getByRole('button', { name: /sign up/i }).click()
}

/**
 * Returns a promise that resolves when the sign in flow is completed.
 *
 * @param page - The page to sign in with.
 * @param email - The email address to sign in with.
 * @param password - The password to sign in with.
 */
export async function signInWithEmailAndPassword({
  page,
  email,
  password
}: {
  page: Page
  email: string
  password: string
}) {
  await page.getByRole('link', { name: /continue with email \+ password/i }).click()
  await page.getByPlaceholder(/email/i).type(email)
  await page.getByPlaceholder(/password/i).type(password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

/**
 * Returns a promise that resolves when the sign in flow is completed.
 *
 * @param page - The page to sign in with.
 */
export async function signInAnonymously({ page }: { page: Page }) {
  await page.getByRole('button', { name: /sign in anonymously/i }).click()
  await page.waitForURL(baseURL)
}

/**
 * Returns a promise that resolves when the sign up flow is completed.
 *
 * @param page - The page to sign up with.
 * @param email - The email address to sign up with.
 */
export async function signUpWithEmailPasswordless({ page, email }: { page: Page; email: string }) {
  await page.getByRole('link', { name: /sign up/i }).click()
  await page.getByRole('link', { name: /continue with a magic link/i }).click()
  await page.getByPlaceholder(/email/i).fill(email)
  await page.getByRole('button', { name: /sign up/i }).click()
}

/**
 * Returns a promise that resolves to a new page that is opened after clicking
 * the magic link in the email.
 *
 * @param email - The email address to reset the password for.
 * @param page - The page to click the magic link in.
 * @param context - The browser context.
 * @returns A promise that resolves to a new page.
 */
export async function verifyMagicLink({
  email,
  page,
  context
}: {
  email: string
  page: Page
  context: BrowserContext
}) {
  await page.goto(mailhogURL)
  await page.locator('.messages > .msglist-message', { hasText: email }).nth(0).click()

  // Based on: https://playwright.dev/docs/pages#handling-new-pages
  const authenticatedPagePromise = context.waitForEvent('page')

  await page
    .frameLocator('#preview-html')
    .getByRole('link', { name: /verify email/i })
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
 * @param page - The page to click the reset password link in.
 * @param context - The browser context.
 * @returns A promise that resolves to a new page.
 */
export async function resetPassword({
  email,
  page,
  context
}: {
  email: string
  page: Page
  context: BrowserContext
}) {
  await page.goto(mailhogURL)
  await page.locator('.messages > .msglist-message', { hasText: email }).nth(0).click()

  // Based on: https://playwright.dev/docs/pages#handling-new-pages
  const authenticatedPagePromise = context.waitForEvent('page')

  await page
    .frameLocator('#preview-html')
    .getByRole('link', { name: /verify email/i })
    .click()

  const authenticatedPage = await authenticatedPagePromise
  await authenticatedPage.getByRole('link', { name: /Verify/i }).click()
  await authenticatedPage.waitForLoadState()
  return authenticatedPage
}

/**
 * Returns a promise that resolves to a new page that is opened after clicking
 * the verify email link in the email.
 *
 * @param email - The email address to verify.
 * @param page - The page to click the verify email link in.
 * @param context - The browser context.
 * @param linkText - The text of the link to click.
 * @returns A promise that resolves to a new page.
 */
export async function verifyEmail({
  email,
  page,
  context,
  linkText = /verify email/i,
  requestType
}: {
  email: string
  page: Page
  context: BrowserContext
  linkText?: string | RegExp
  requestType?: 'email-confirm-change' | 'email-verify' | 'password-reset' | 'signin-passwordless'
}) {
  await page.goto(mailhogURL)
  await page.locator('.messages > .msglist-message', { hasText: email }).nth(0).click()

  // Based on: https://playwright.dev/docs/pages#handling-new-pages
  const verifyEmailPagePromise = context.waitForEvent('page')
  await page.frameLocator('#preview-html').getByRole('link', { name: linkText }).click()
  const verifyEmailPage = await verifyEmailPagePromise
  await verifyEmailPage.waitForLoadState()

  if (requestType === 'email-confirm-change') {
    return verifyEmailPage
  }

  await verifyEmailPage.getByRole('link', { name: /verify/i }).click()
  await verifyEmailPage.waitForLoadState()
  return verifyEmailPage
}

/**
 * Returns decoded data from a QR code.
 *
 * @param base64String - The base64 encoded string of the QR code.
 * @returns The decoded data.
 */
export function decodeQRCode(base64String?: string | null) {
  if (!base64String) {
    return {
      secret: '',
      algorithm: '',
      digits: '',
      period: ''
    }
  }

  const buffer = Buffer.from(base64String.replace('data:image/png;base64,', ''), 'base64')
  const pngData = PNG.sync.read(buffer)

  const decoded = jsQR(Uint8ClampedArray.from(pngData.data), pngData.width, pngData.height)
  const params = decoded?.data?.split('?').at(-1)

  // note: we are decoding MFA here
  const { secret, algorithm, digits, period } = Object.fromEntries(new URLSearchParams(params))

  return { secret, algorithm, digits, period }
}

/**
 * Clears the local and session storage for a page.
 *
 * @param page - The page to clear the storage for.
 */
export async function clearStorage({ page }: { page: Page }) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * Returns a promise that resolves to the value of a key in local storage.
 *
 * @param page - The page to get the value from.
 * @param origin - The origin of the local storage.
 * @param key - The key to get the value for.
 * @returns The value of the key in local storage.
 */
export async function getValueFromLocalStorage({
  page,
  origin: externalOrigin,
  key
}: {
  page: Page
  origin: string
  key: string
}) {
  const storageState = await page.context().storageState()
  const localStorage = storageState.origins.find(
    ({ origin }) => origin === externalOrigin
  )?.localStorage
  const value = localStorage?.find(({ name }) => name === key)?.value

  return value || null
}
