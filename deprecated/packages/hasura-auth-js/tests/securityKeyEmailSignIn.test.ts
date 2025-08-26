import { faker } from '@faker-js/faker'
import { AuthenticationCredentialJSON } from '@simplewebauthn/typescript-types'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  authTokenNetworkErrorHandler,
  correctEmailSecurityKeyHandler,
  correctSecurityKeyVerifyHandler,
  emailSecurityKeyNetworkErrorHandler,
  incorrectSecurityKeyVerifyHandler,
  unverifiedEmailSecurityKeyErrorHandler,
  userNotFoundSecurityKeyHandler
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

const mockAuthenticator = () => {
  vi.mock('@simplewebauthn/browser', () => {
    return {
      default: {},
      startAuthentication: vi.fn(async (): Promise<AuthenticationCredentialJSON> => {
        return {
          id: faker.datatype.uuid(),
          rawId: faker.datatype.uuid(),
          response: {
            authenticatorData: faker.datatype.string(30),
            clientDataJSON: faker.datatype.string(30),
            signature: faker.datatype.string(30)
          },
          type: 'public-key',
          clientExtensionResults: {}
        }
      })
    }
  })
}
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
  vi.restoreAllMocks()
})

test(`should fail if network is unavailable`, async () => {
  server.use(emailSecurityKeyNetworkErrorHandler, authTokenNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.email()
  })

  const state = await waitFor(authService, (s) => s.matches('authentication.signedOut.failed'))

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
  server.use(emailSecurityKeyNetworkErrorHandler, authTokenNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.email()
  })

  const state = await waitFor(authService, (s) => s.matches('authentication.signedOut.failed'))

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

test(`should fail if email is incorrectly formatted`, async () => {
  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.userName()
  })

  const emailErrorSignInState = await waitFor(authService, (s) =>
    s.matches('authentication.signedOut.failed')
  )
  expect(emailErrorSignInState.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-email",
          "message": "Email is incorrectly formatted",
          "status": 10,
        },
      }
  `)
})

test(`should fail if server does not find the user`, async () => {
  server.use(userNotFoundSecurityKeyHandler)

  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.email()
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "user-not-found",
        "message": "No user found",
        "status": 400,
      },
    }
  `)
})

test(`should fail if user email needs verification`, async () => {
  server.use(unverifiedEmailSecurityKeyErrorHandler)

  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.email()
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "unverified-email",
        "message": "Email needs verification",
        "status": 401,
      },
    }
  `)
})

test(`should fail if the user secret key is incorrect`, async () => {
  server.use(correctEmailSecurityKeyHandler, incorrectSecurityKeyVerifyHandler)
  mockAuthenticator()
  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.email()
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
  {
    "authentication": {
      "error": "invalid-webauthn-authenticator",
      "message": "Invalid WebAuthn authenticator",
      "status": 401,
    },
  }
`)
})

test(`should succeed if correct credentials are provided`, async () => {
  server.use(correctEmailSecurityKeyHandler, correctSecurityKeyVerifyHandler)
  mockAuthenticator()

  authService.send({
    type: 'SIGNIN_SECURITY_KEY_EMAIL',
    email: faker.internet.email()
  })

  const state = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(state.context.user).not.toBeNull()
})
