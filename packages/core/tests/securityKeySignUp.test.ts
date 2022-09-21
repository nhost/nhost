import faker from '@faker-js/faker'
import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types'
import { vi } from 'vitest'
import { interpret, StateFrom } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthMachine, createAuthMachine } from '../src/machines'
import { BASE_URL } from './helpers/config'
import {
  signUpSecurityKeyConflictErrorHandler,
  signUpSecurityKeyInternalErrorHandler,
  signUpSecurityKeyNetworkErrorHandler,
  signUpSecurityKeySuccessHandler,
  signUpVerifySecurityKeySuccessHandler,
  signUpVerifySecurityKeySuccessWithSessionHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

type AuthState = StateFrom<AuthMachine>

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
      startRegistration: vi.fn(async (): Promise<RegistrationCredentialJSON> => {
        return {
          id: faker.datatype.uuid(),
          rawId: faker.datatype.uuid(),
          response: {
            clientDataJSON: faker.datatype.string(30),
            attestationObject: faker.datatype.string(30)
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
})

test(`should fail if network is unavailable`, async () => {
  server.use(signUpSecurityKeyNetworkErrorHandler)

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
        "error": "OK",
        "message": "Network Error",
        "status": 200,
      },
    }
  `)
})

test(`should fail if server returns an error`, async () => {
  server.use(signUpSecurityKeyInternalErrorHandler)

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
  // Scenario 1: Providing an invalid email address with a valid password
  authService.send({
    type: 'SIGNUP_SECURITY_KEY',
    email: faker.internet.userName()
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

  // Scenario 2: Providing a valid email address with an invalid password
  authService.send({
    type: 'SIGNUP_EMAIL_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(2)
  })

  const passwordErrorSignInState: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches('registration.incomplete.failed')
  )

  expect(passwordErrorSignInState.context.errors).toMatchInlineSnapshot(`
      {
        "registration": {
          "error": "invalid-password",
          "message": "Password is incorrectly formatted",
          "status": 10,
        },
      }
    `)
})

test(`should fail if email has already been taken`, async () => {
  server.use(signUpSecurityKeyConflictErrorHandler)

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
  server.use(signUpSecurityKeySuccessHandler, signUpVerifySecurityKeySuccessHandler)
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
  server.use(signUpSecurityKeySuccessHandler, signUpVerifySecurityKeySuccessWithSessionHandler)
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
