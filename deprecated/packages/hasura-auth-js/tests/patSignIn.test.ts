import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  patSignInInternalErrorHandler,
  patSignInNetworkErrorHandler,
  patSignInUnauthorizedErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

const customStorage = new CustomClientStorage(new Map())

const authMachine = createAuthMachine({
  backendUrl: BASE_URL,
  clientUrl: 'http://localhost:3000',
  clientStorage: customStorage,
  clientStorageType: 'custom',
  refreshIntervalTime: 1
})

const authService = interpret(authMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  authService.start()
})

afterEach(() => {
  authService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if network is unavailable`, async () => {
  server.use(patSignInNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_PAT',
    pat: faker.datatype.uuid()
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "network",
        "message": "Network Error",
        "status": 0,
      },
    }
  `)
})

test(`should fail if server returns an error`, async () => {
  server.use(patSignInInternalErrorHandler)

  authService.send({
    type: 'SIGNIN_PAT',
    pat: faker.datatype.uuid()
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "internal-error",
        "message": "Internal error",
        "status": 500,
      },
    }
  `)
})

test(`should succeed if a correct PAT is used`, async () => {
  authService.send({
    type: 'SIGNIN_PAT',
    pat: faker.datatype.uuid()
  })

  const state = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: 'disabled' } } })
  )

  expect(state.context.user).not.toBeNull()
})

test(`should fail if an invalid PAT is used`, async () => {
  server.use(patSignInUnauthorizedErrorHandler)

  authService.send({
    type: 'SIGNIN_PAT',
    pat: faker.datatype.uuid()
  })

  const state = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  expect(state.context.user).toBeNull()
  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "invalid-or-expired-pat",
        "message": "Invalid or expired PAT",
        "status": 401,
      },
    }
  `)
})
