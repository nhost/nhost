import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { signInAnonymously, signUpWithEmailAndPassword, verifyEmail } from '../utils'

test('should add an item to the todo list when authenticated with email and password', async ({
  page
}) => {
  const email = faker.internet.email()
  const password = faker.internet.password()
  const sentence = faker.lorem.sentence()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })

  await newPage.getByRole('link', { name: /todos/i }).click()
  await expect(newPage.getByRole('heading', { name: /todos/i })).toBeVisible()

  await newPage.getByRole('textbox').fill(sentence)
  await newPage.getByRole('button', { name: /add/i }).click()
  await expect(newPage.getByRole('main')).toContainText(sentence)
})

test('should add an item to the todo list when authenticated anonymously', async ({ page }) => {
  const sentence = faker.lorem.sentence()

  await page.goto('/')

  await signInAnonymously({ page })

  await page.getByRole('link', { name: /todos/i }).click()
  await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible()

  await page.getByRole('textbox').fill(sentence)
  await page.getByRole('button', { name: /add/i }).click()
  await expect(page.getByRole('main')).toContainText(sentence)
})

test('should fail when network is not available', async ({ page }) => {
  const sentence = faker.lorem.sentence()

  await page.goto('/')

  await signInAnonymously({ page })
  await page.getByRole('link', { name: /todos/i }).click()
  await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible()

  await page.route('**', (route) => route.abort('internetdisconnected'))
  await page.getByRole('textbox').fill(sentence)
  await page.getByRole('button', { name: /add/i }).click()

  await expect(page.getByText(/failed to fetch/i)).toBeVisible()
})
