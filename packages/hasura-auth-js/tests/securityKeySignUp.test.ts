import { faker } from '@faker-js/faker'
import { RegistrationResponseJSON } from '@simplewebauthn/types'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { interpret, StateFrom } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthMachine, createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  signUpEmailSecurityKeyConflictErrorHandler,
  signUpEmailSecurityKeyInternalErrorHandler,
  signUpEmailSecurityKeyNetworkErrorHandler,
  signUpEmailSecurityKeySuccessHandler,
  signUpVerifySecurityKeySuccessHandler,
  signUpVerifySecurityKeySuccessWithSessionHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

type AuthState = StateFrom<AuthMachine>

describe('Security Key', () => {
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
        startRegistration: vi.fn(async (): Promise<RegistrationResponseJSON> => {
          return {
            id: faker.string.uuid(),
            rawId: faker.string.uuid(),
            response: {
              clientDataJSON: faker.string.sample(30),
              attestationObject: faker.string.sample(30)
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
    server.use(signUpEmailSecurityKeyNetworkErrorHandler)

    authService.send({
      type: 'SIGNUP_SECURITY_KEY',
      email: faker.internet.email()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches('registration.incomplete.failed')
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "registration": {
          "error": "network",
          "message": "Network Error",
          "status": 0,
        },
      }
    `)
  })

  test(`should fail if server returns an error`, async () => {
    server.use(signUpEmailSecurityKeyInternalErrorHandler)

    authService.send({
      type: 'SIGNUP_SECURITY_KEY',
      email: faker.internet.email()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches('registration.incomplete.failed')
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "registration": {
          "error": "internal-error",
          "message": "Internal error",
          "status": 500,
        },
      }
    `)
  })

  test(`should fail if email is incorrectly formatted`, async () => {
    authService.send({
      type: 'SIGNUP_SECURITY_KEY',
      email: faker.internet.username()
    })

    const emailErrorSignInState: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches('registration.incomplete.failed')
    )

    expect(emailErrorSignInState.context.errors).toMatchInlineSnapshot(`
        {
          "registration": {
            "error": "invalid-email",
            "message": "Email is incorrectly formatted",
            "status": 10,
          },
        }
      `)
  })

  test(`should fail if email has already been taken`, async () => {
    server.use(signUpEmailSecurityKeyConflictErrorHandler)

    authService.send({
      type: 'SIGNUP_SECURITY_KEY',
      email: faker.internet.email()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches('registration.incomplete.failed')
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "registration": {
          "error": "email-already-in-use",
          "message": "Email already in use",
          "status": 409,
        },
      }
    `)
  })

  test(`should succeed if email is correctly formatted but pending verification`, async () => {
    server.use(signUpEmailSecurityKeySuccessHandler, signUpVerifySecurityKeySuccessHandler)
    mockAuthenticator()

    authService.send({
      type: 'SIGNUP_SECURITY_KEY',
      email: faker.internet.email()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({
        registration: { incomplete: 'needsEmailVerification' },
        authentication: { signedOut: 'noErrors' }
      })
    )

    expect(state.context.user).toBeNull()
    expect(state.context.errors).toMatchInlineSnapshot('{}')
  })

  test(`should succeed if email is correctly formatted and user is already signed up`, async () => {
    server.use(
      signUpEmailSecurityKeySuccessHandler,
      signUpVerifySecurityKeySuccessWithSessionHandler
    )
    mockAuthenticator()

    authService.send({
      type: 'SIGNUP_SECURITY_KEY',
      email: faker.internet.email()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})
