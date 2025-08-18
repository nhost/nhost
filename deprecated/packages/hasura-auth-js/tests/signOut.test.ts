import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine, NHOST_REFRESH_TOKEN_KEY } from '../src'
import { BASE_URL } from './helpers/config'
import {
  signOutAllErrorHandler,
  signOutInternalErrorHandler,
  signOutNetworkErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

/**
 * Simulate sign in with password.
 *
 * @returns Promise that resolves when the sign in process is finished.
 */
function simulateSignIn() {
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  return waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )
}

const customStorage = new CustomClientStorage(new Map())

const authMachine = createAuthMachine({
  backendUrl: BASE_URL,
  clientUrl: 'http://localhost:3000',
  clientStorage: customStorage,
  clientStorageType: 'custom',
  refreshIntervalTime: 1
})

const authService = interpret(authMachine)

beforeEach(() => {
  authService.start()
})

afterEach(() => {
  authService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if network is unavailable`, async () => {
  server.use(signOutNetworkErrorHandler)

  await simulateSignIn()

  authService.send({
    type: 'SIGNOUT'
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
  server.use(signOutInternalErrorHandler)

  await simulateSignIn()

  authService.send({
    type: 'SIGNOUT'
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

test(`should fail if user wants to sign out from all devices using an invalid token`, async () => {
  server.use(signOutAllErrorHandler)

  await simulateSignIn()

  authService.send({
    type: 'SIGNOUT',
    all: true
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "unauthenticated-user",
        "message": "User must be signed in to sign out from all sessions",
        "status": 401,
      },
    }
  `)
})

test(`should succeed if even if no user was signed in previously`, async () => {
  authService.send({ type: 'SIGNOUT' })

  const state = await waitFor(authService, (state) => !!state.value)

  expect(state.matches({ authentication: { signedOut: 'noErrors' } })).toBeTruthy()
})

test(`should succeed if user wants to sign out from all devices and provides a valid token`, async () => {
  const signedInState = await simulateSignIn()

  expect(signedInState.context.user).not.toBeNull()

  authService.send({
    type: 'SIGNOUT',
    all: true
  })

  const signedOutState = await waitFor(authService, (state) =>
    state.matches({
      authentication: { signedOut: 'success' }
    })
  )

  expect(signedOutState.context.accessToken.value).toBeNull()
  expect(signedOutState.context.user).toBeNull()
  expect(customStorage.getItem(NHOST_REFRESH_TOKEN_KEY)).not.toBeDefined()
})

test(`should succeed if user was previously signed in`, async () => {
  const signedInState = await simulateSignIn()

  expect(signedInState.context.user).not.toBeNull()

  authService.send({
    type: 'SIGNOUT'
  })

  const signedOutState = await waitFor(authService, (state) =>
    state.matches({
      authentication: { signedOut: 'success' }
    })
  )

  expect(signedOutState.context.accessToken.value).toBeNull()
  expect(signedOutState.context.user).toBeNull()
  expect(customStorage.getItem(NHOST_REFRESH_TOKEN_KEY)).not.toBeDefined()
})
