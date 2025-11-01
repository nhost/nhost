import { faker } from '@faker-js/faker'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import totp from 'totp-generator'
import { baseURL } from '../config'
import {
  decodeQRCode,
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
  verifyEmail
} from '../utils'

const email = faker.internet.email()
const password = faker.internet.password()

let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()

  await page.goto('/')
  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await expect(newPage.getByText(/you are authenticated/i)).toBeVisible()
  await newPage.getByRole('link', { name: /sign out/i }).click()

  page = newPage
})

test.afterEach(async () => {
  await page.getByRole('link', { name: /sign out/i }).click()
})

test.afterAll(() => {
  page.close()
})

test('should sign in with email and password', async () => {
  await page.goto('/')

  await signInWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/you are authenticated/i)).toBeVisible()
})

// TODO: Create email verification test

test('should activate and sign in with MFA', async () => {
  await page.goto('/')

  await signInWithEmailAndPassword({ page, email, password })
  await page.waitForURL(baseURL)
  await page.getByRole('link', { name: /profile/i }).click()
  await page.getByRole('button', { name: /generate/i }).click()

  const image = page.getByAltText(/qrcode/i)
  const src = await image.getAttribute('src')

  const { secret, algorithm, digits, period } = decodeQRCode(src)

  const code = totp(secret, {
    algorithm: algorithm.replace('SHA1', 'SHA-1'),
    digits: parseInt(digits),
    period: parseInt(period)
  })

  await page.getByPlaceholder(/enter activation code/i).fill(code)
  await page.getByRole('button', { name: /activate/i }).click()
  await expect(page.getByText(/mfa has been activated/i)).toBeVisible()
  await page.getByRole('link', { name: /sign out/i }).click()

  await signInWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/send 2-step verification code/i)).toBeVisible()

  const newCode = totp(secret, { timestamp: Date.now() })

  await page.getByPlaceholder(/one-time password/i).fill(newCode)
  await page.getByRole('button', { name: /send 2-step verification code/i }).click()
  await expect(page.getByText(/you are authenticated/i)).toBeVisible()
})
