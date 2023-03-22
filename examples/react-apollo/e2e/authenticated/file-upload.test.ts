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
  await newPage.getByRole('button', { name: /storage/i }).click()

  await newPage
    .getByRole('button', { name: /drag a file here or click to select/i })
    .locator('input[type=file]')
    .setInputFiles({
      buffer: Buffer.from('file contents', 'utf-8'),
      name: 'file.txt',
      mimeType: 'text/plain'
    })

  await expect(newPage.getByText(/successfully uploaded/i)).toBeVisible()
})

test('should upload two files using the same single file uploader', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('button', { name: /storage/i }).click()

  await newPage
    .getByRole('button', { name: /drag a file here or click to select/i })
    .locator('input[type=file]')
    .setInputFiles({
      buffer: Buffer.from('file contents 1', 'utf-8'),
      name: 'file1.txt',
      mimeType: 'text/plain'
    })

  await expect(newPage.getByText(/successfully uploaded/i)).toBeVisible()

  await newPage
    .getByRole('button', { name: /successfully uploaded/i })
    .locator('input[type=file]')
    .setInputFiles({
      buffer: Buffer.from('file contents 2', 'utf-8'),
      name: 'file2.txt',
      mimeType: 'text/plain'
    })

  await expect(newPage.getByText(/successfully uploaded/i)).toBeVisible()
})

test('should upload multiple files at once', async ({ page }) => {
  const email = faker.internet.email()
  const password = faker.internet.password()

  await page.goto('/')

  await signUpWithEmailAndPassword({ page, email, password })
  await expect(page.getByText(/verification email sent/i)).toBeVisible()

  const newPage = await verifyEmail({ page, email, context: page.context() })
  await newPage.getByRole('button', { name: /storage/i }).click()

  await newPage
    .getByRole('button', { name: /drag files here or click to select/i })
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

  await expect(newPage.getByRole('row').nth(0)).toHaveText('file1.txt')
  await expect(newPage.getByRole('row').nth(1)).toHaveText('file2.txt')
  await newPage.getByRole('button', { name: /upload/i }).click()

  await expect(newPage.getByText(/successfully uploaded/i)).toBeVisible()
})
