import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { HasuraAuthClient } from '../src'
import { BASE_URL } from './helpers/config'
import { createPATExpirationErrorHandler } from './helpers/handlers'
import server from './helpers/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

const client = new HasuraAuthClient({
  url: `${BASE_URL}`
})

test('should create a PAT', async () => {
  const { error, data } = await client.createPAT(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7))

  expect(error).toBeFalsy()
  expect(data).toBeTruthy()
  expect(data?.id).not.toBeNull()
  expect(data?.personalAccessToken).not.toBeNull()
})

test('should fail to create a PAT if the expiration date is invalid', async () => {
  server.use(createPATExpirationErrorHandler)

  const { error, data } = await client.createPAT(new Date(Date.now() - 1000 * 60 * 60 * 24 * 7))

  expect(error).toBeTruthy()
  expect(data).toBeFalsy()
})
