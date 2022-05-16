import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { NHOST_REFRESH_TOKEN_KEY } from '../src/constants'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  signOutAllErrorHandler,
  signOutInternalErrorHandler,
  signOutNetworkErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import customStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'

type AuthState = GeneralAuthState<Typegen0>

/**
 * Simulate sign in with password.
 *
 * @returns Promise that resolves when the sign in process is finished.
 */
function simulateSignIn(): Promise<AuthState> {
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  return waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )
}

// Initializing AuthMachine with custom storage to have control over its content between tests
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
  server.use(signOutNetworkErrorHandler)

  await simulateSignIn()

  authService.send({
    type: 'SIGNOUT'
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedOut: { failed: 'server' } } })
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "OK",
        "message": "Network Error",
        "status": 200,
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

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedOut: { failed: 'server' } } })
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

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedOut: { failed: 'server' } } })
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

  const state: AuthState = await waitFor(authService, (state: AuthState) => !!state.value)

  expect(state.matches({ authentication: { signedOut: 'noErrors' } })).toBeTruthy()
})

test(`should succeed if user wants to sign out from all devices and provides a valid token`, async () => {
  const signedInState = await simulateSignIn()

  expect(signedInState.context.user).not.toBeNull()

  authService.send({
    type: 'SIGNOUT',
    all: true
  })

  const signedOutState: AuthState = await waitFor(authService, (state: AuthState) =>
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

  const signedOutState: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({
      authentication: { signedOut: 'success' }
    })
  )

  expect(signedOutState.context.accessToken.value).toBeNull()
  expect(signedOutState.context.user).toBeNull()
  expect(customStorage.getItem(NHOST_REFRESH_TOKEN_KEY)).not.toBeDefined()
})
