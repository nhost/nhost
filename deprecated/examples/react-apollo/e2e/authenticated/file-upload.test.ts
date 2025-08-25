import { faker } from '@faker-js/faker'
import { expect, test } from '@playwright/test'
import { signUpWithEmailAndPassword, verifyEmail } from '../utils'

test('should upload a single file', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /storage/i }).click()

  await newPage
    .locator('div')
    .filter({ hasText: /^Drag a file here or click to select$/ })
    .nth(1)
    .locator('input[type=file]')
    .setInputFiles({
      buffer: Buffer.from('file contents', 'utf-8'),
      name: 'file.txt',
      mimeType: 'text/plain'
    })

  await expect(newPage.getByText(/Uploaded successfully/i)).toBeVisible()
})

test('should upload two files using the same single file uploader', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /storage/i }).click()

  await newPage
    .locator('div')
    .filter({ hasText: /^Drag a file here or click to select$/ })
    .nth(1)
    .locator('input[type=file]')
    .setInputFiles({
      buffer: Buffer.from('file contents 1', 'utf-8'),
      name: 'file1.txt',
      mimeType: 'text/plain'
    })

  await expect(newPage.getByText(/Uploaded successfully/i)).toBeVisible()

  await newPage
    .locator('div')
    .filter({ hasText: /^Uploaded successfully$/ })
    .nth(1)
    .locator('input[type=file]')
    .setInputFiles({
      buffer: Buffer.from('file contents 2', 'utf-8'),
      name: 'file2.txt',
      mimeType: 'text/plain'
    })

  await expect(newPage.getByText(/Uploaded successfully/i)).toBeVisible()
})

test('should upload multiple files at once', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('link', { name: /storage/i }).click()

  await newPage
    .locator('div')
    .filter({ hasText: /^Drag a file here or click to select$/ })
    .nth(3)
    .locator('input[type=file]')
    .setInputFiles([
      {
        buffer: Buffer.from('file contents 1', 'utf-8'),
        name: 'file1.txt',
        mimeType: 'text/plain'
      },
      {
        buffer: Buffer.from('file contents 2', 'utf-8'),
        name: 'file2.txt',
        mimeType: 'text/plain'
      }
    ])

  await expect(newPage.getByText('file1.txt')).toBeVisible()
  await expect(newPage.getByText('file2.txt')).toBeVisible()
  await newPage.getByRole('button', { name: /upload/i }).click()

  await expect(newPage.getByText(/Uploaded successfully/i)).toBeVisible()
})
