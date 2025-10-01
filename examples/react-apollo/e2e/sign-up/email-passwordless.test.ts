import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { signUpWithEmailPasswordless, verifyMagicLink } from '../utils'

test('should sign up with a magic link', async ({ page, context }) => {
  page.goto('/')

  const email = faker.internet.email()

  await signUpWithEmailPasswordless({ page, email })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const authenticatedPage = await verifyMagicLink({ page, context, email })
  await authenticatedPage.getByRole('link', { name: /home/i }).click()
  await expect(
    authenticatedPage.getByText(
      /You are authenticated. You have now access to the authorised part of the application./i
    )
  ).toBeVisible()
})

test('should fail when network is not available', async ({ page }) => {
  await page.goto('/')

  const email = faker.internet.email()

  await page.route('**', (route) => route.abort('internetdisconnected'))
  await signUpWithEmailPasswordless({ page, email })

  await expect(page.getByText(/network error/i)).toBeVisible()
})
