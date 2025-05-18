import CustomClientStorage from './helpers/storage'
import { HasuraAuthClient } from '../src'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import { faker } from '@faker-js/faker'

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          session: { accessToken: faker.random.alphaNumeric(), accessTokenExpiresIn: 900 },
          error: null
        })
    })
  )
}))

vi.stubGlobal('fetch', mocks.mockFetch)
vi.mock('fetch-ponyfill', async () => ({
  default: () => ({ fetch: mocks.mockFetch })
}))

const AUTH_BACKEND_URL = 'https://local.auth.local.nhost.run/v1'

const customStorage = new CustomClientStorage(new Map())

let hasuraClient: HasuraAuthClient

const EMAIL = faker.internet.email()
const PASSWORD = faker.internet.password({ length: 15 })
const CUSTOM_HEADERS = { headers: { 'custom-header': 'custom-header-value' } }

beforeEach(() => {
  hasuraClient = new HasuraAuthClient({
    url: AUTH_BACKEND_URL,
    broadcastKey: 'mock-broadcast-key',
    clientStorage: customStorage
  })
})

afterEach(() => {
  hasuraClient.signOut()
})

test('should send headers with signup email-password request', async () => {
  await hasuraClient.signUp({ email: EMAIL, password: PASSWORD }, CUSTOM_HEADERS)

  expect((mocks.mockFetch.mock.calls as any)[0][1].headers).toEqual(
    expect.objectContaining(CUSTOM_HEADERS.headers)
  )
})

test('should send headers with signup with security key', async () => {
  await hasuraClient.signUp({ email: EMAIL, securityKey: true }, CUSTOM_HEADERS)

  expect((mocks.mockFetch.mock.calls as any)[0][1].headers).toEqual(
    expect.objectContaining(CUSTOM_HEADERS.headers)
  )
})
