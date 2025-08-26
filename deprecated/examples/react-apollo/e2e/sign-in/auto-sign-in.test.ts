import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { authBackendURL, baseURL } from '../config'
import {
  clearStorage,
  getValueFromLocalStorage,
  signUpWithEmailAndPassword,
  verifyEmail
} from '../utils'

test('should sign in automatically with a refresh token', async ({ page }) => {
  await page.goto('/')

  const email = faker.internet.email()
  const password = faker.internet.password()

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })

  await expect(newPage.getByText(/you are authenticated/i)).toBeVisible()

  const refreshToken = await getValueFromLocalStorage({
    page: newPage,
    origin: baseURL,
    key: 'nhostRefreshToken'
  })

  // Clear storage and reload the page
  await clearStorage({ page: newPage })
  await newPage.reload()

  await expect(newPage.getByText(/sign in/i).nth(1)).toBeVisible()

  // User should be signed in automatically
  await newPage.goto(`${baseURL}/profile?refreshToken=${refreshToken}`)
  await expect(newPage.getByRole('heading', { name: 'Profile' })).toBeVisible()
})

test('should fail automatic sign-in when network is not available', async ({ page }) => {
  await page.goto('/')

  const email = faker.internet.email()
  const password = faker.internet.password()

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })

  await expect(newPage.getByText(/you are authenticated/i)).toBeVisible()

  const refreshToken = await getValueFromLocalStorage({
    page: newPage,
    origin: baseURL,
    key: 'nhostRefreshToken'
  })

  // Clear storage and reload the page
  await clearStorage({ page: newPage })
  await newPage.reload()

  await expect(newPage.getByText(/sign in/i).nth(1)).toBeVisible()
  await newPage.route(`${authBackendURL}/**`, (route) => route.abort('internetdisconnected'))

  // User should be signed in automatically
  await newPage.goto(`${baseURL}/profile?refreshToken=${refreshToken}`)
  await expect(
    newPage.getByText(/could not sign in automatically. retrying to get user information/i)
  ).toBeVisible()
})
