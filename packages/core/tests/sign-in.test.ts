import faker from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { BaseActionObject, interpret, ResolveTypegenMeta, ServiceMap, State } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthContext, AuthEvents, createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import {
  authTokenNetworkErrorHandler,
  emailPasswordNetworkErrorHandler,
  incorrectEmailPasswordHandler,
  mfaTotpInternalErrorHandler,
  mfaTotpInvalidOtpHandler,
  mfaTotpNetworkErrorHandler,
  passwordlessEmailInternalErrorHandler,
  passwordlessEmailNetworkErrorHandler,
  passwordlessSmsInternalErrorHandler,
  passwordlessSmsNetworkErrorHandler,
  passwordlessSmsOtpInternalErrorHandler,
  passwordlessSmsOtpInvalidOtpHandler,
  passwordlessSmsOtpNetworkErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import customStorage from './helpers/storage'

type AuthState = State<
  AuthContext,
  AuthEvents,
  any,
  {
    value: any
    context: AuthContext
  },
  ResolveTypegenMeta<Typegen0, AuthEvents, BaseActionObject, ServiceMap>
>

// Initialzing AuthMachine with custom storage to have control over its content between tests
const authMachine = createAuthMachine({
  backendUrl: 'http://localhost:1337/v1/auth',
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

describe(`Email and password sign in`, () => {
  test(`should fail if network is unavailable`, async () => {
    server.use(emailPasswordNetworkErrorHandler, authTokenNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORD',
      email: faker.internet.email(),
      password: faker.internet.password(15)
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

  test(`should fail if a server error occurred`, async () => {
    server.use(emailPasswordNetworkErrorHandler, authTokenNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORD',
      email: faker.internet.email(),
      password: faker.internet.password(15)
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

  test(`should retry token refresh if refresh endpoint is unreachable`, async () => {
    server.use(authTokenNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORD',
      email: faker.internet.email(),
      password: faker.internet.password(15)
    })

    await waitFor(authService, (state: AuthState) =>
      state.matches({
        authentication: { signedIn: { refreshTimer: { running: 'refreshing' } } }
      })
    )

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({
        authentication: { signedIn: { refreshTimer: { running: 'pending' } } }
      })
    )

    expect(state.context.refreshTimer.attempts).toBeGreaterThan(0)
  })

  test(`should fail if either the provided email address or provided password was invalid`, async () => {
    // Scenario 1: Providing an invalid email address with a valid password
    authService.send({
      type: 'SIGNIN_PASSWORD',
      email: faker.internet.userName(),
      password: faker.internet.password(15)
    })

    const emailErrorSignInState: AuthState = await waitFor(
      authService,
      (state: AuthState) => !!state.value
    )

    expect(
      emailErrorSignInState.matches({
        authentication: { signedOut: { failed: { validation: 'email' } } }
      })
    ).toBeTruthy()

    // Scenario 2: Providing a valid email address with an invalid password
    authService.send({
      type: 'SIGNIN_PASSWORD',
      email: faker.internet.email('john', 'doe'),
      password: faker.internet.password(2)
    })

    const passwordErrorSignInState: AuthState = await waitFor(
      authService,
      (state: AuthState) => !!state.value
    )

    expect(
      passwordErrorSignInState.matches({
        authentication: { signedOut: { failed: { validation: 'password' } } }
      })
    ).toBeTruthy()
  })

  test(`should fail if incorrect credentials are provided`, async () => {
    server.use(incorrectEmailPasswordHandler)

    const email = faker.internet.email('john', 'doe')
    const password = faker.internet.password(15)

    authService.send({
      type: 'SIGNIN_PASSWORD',
      email,
      password
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: { failed: 'server' } } })
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-email-password",
          "message": "Incorrect email or password",
          "status": 401,
        },
      }
    `)
  })

  test(`should succeed if correct credentials are provided`, async () => {
    const email = faker.internet.email('john', 'doe')
    const password = faker.internet.password(15)

    authService.send({
      type: 'SIGNIN_PASSWORD',
      email,
      password
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})

describe('Passwordless email sign in', () => {
  test('should fail if network is unavailable', async () => {
    server.use(passwordlessEmailNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: faker.internet.email()
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

  test(`should fail if a server error occurred`, async () => {
    server.use(passwordlessEmailInternalErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: faker.internet.email()
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

  test(`should fail if the provided email address was invalid`, async () => {
    authService.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: faker.internet.userName()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) => !!state.value)

    expect(
      state.matches({
        authentication: { signedOut: { failed: { validation: 'email' } } }
      })
    ).toBeTruthy()
  })

  test(`should succeed if the provided email address was valid`, async () => {
    authService.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: faker.internet.email()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
    )

    expect(state.context.user).toBeNull()
    expect(state.context.errors).toMatchInlineSnapshot(`{}`)
  })
})

describe(`Passwordless SMS sign in`, () => {
  test(`should fail if network is unavailable`, async () => {
    server.use(passwordlessSmsNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS',
      phoneNumber: faker.phone.phoneNumber()
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

  test(`should fail if a server error occurred`, async () => {
    server.use(passwordlessSmsInternalErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS',
      phoneNumber: faker.phone.phoneNumber()
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

  test(`should fail if the provided phone number was invalid`, async () => {
    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS',
      // TODO: Phone number validation is not implemented yet
      phoneNumber: ''
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) => !!state.value)

    expect(
      state.matches({
        authentication: { signedOut: { failed: { validation: 'phoneNumber' } } }
      })
    ).toBeTruthy()
  })

  test(`should succeed if the provided phone number was valid`, async () => {
    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS',
      phoneNumber: faker.phone.phoneNumber()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: 'needsSmsOtp' } })
    )

    expect(state.context.user).toBeNull()
    expect(state.context.errors).toMatchInlineSnapshot(`{}`)
  })
})

describe(`SMS OTP sign in`, () => {
  test(`should fail if network is unavailable`, async () => {
    server.use(passwordlessSmsOtpNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
      phoneNumber: faker.phone.phoneNumber(),
      otp: faker.random.numeric(6).toString()
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

  test(`should fail if a server error occurred`, async () => {
    server.use(passwordlessSmsOtpInternalErrorHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
      phoneNumber: faker.phone.phoneNumber(),
      otp: faker.random.numeric(6).toString()
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

  test(`should fail if the provided phone number was invalid`, async () => {
    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
      // TODO: Phone number validation is not implemented yet
      phoneNumber: '',
      otp: faker.random.numeric(6).toString()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) => !!state.value)

    expect(
      state.matches({
        authentication: { signedOut: { failed: { validation: 'phoneNumber' } } }
      })
    ).toBeTruthy()
  })

  test(`should fail if the provided OTP was invalid`, async () => {
    server.use(passwordlessSmsOtpInvalidOtpHandler)

    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
      phoneNumber: faker.phone.phoneNumber(),
      otp: faker.random.numeric(6).toString()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: { failed: 'server' } } })
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-otp",
          "message": "Invalid or expired OTP",
          "status": 401,
        },
      }
    `)
  })

  test(`should succeed if the provided phone number and OTP were valid`, async () => {
    authService.send({
      type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
      phoneNumber: faker.phone.phoneNumber(),
      otp: faker.random.numeric(6).toString()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})

describe(`MFA TOTP sign in`, () => {
  test(`should fail if network is unavailable`, async () => {
    server.use(mfaTotpNetworkErrorHandler)

    authService.send({
      type: 'SIGNIN_MFA_TOTP',
      ticket: `mfaTotp:${faker.datatype.uuid()}`,
      otp: faker.random.numeric(6).toString()
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

  test(`should fail if a server error occurred`, async () => {
    server.use(mfaTotpInternalErrorHandler)

    authService.send({
      type: 'SIGNIN_MFA_TOTP',
      ticket: `mfaTotp:${faker.datatype.uuid()}`,
      otp: faker.random.numeric(6).toString()
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

  test(`should fail if MFA ticket is not provided or invalid`, async () => {
    authService.send({
      type: 'SIGNIN_MFA_TOTP',
      ticket: '',
      otp: faker.random.numeric(6).toString()
    })

    const noTicketState: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: { failed: 'server' } } })
    )

    expect(noTicketState.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "no-mfa-ticket",
          "message": "No MFA ticket has been provided",
          "status": 10,
        },
      }
    `)

    authService.send({
      type: 'SIGNIN_MFA_TOTP',
      ticket: '',
      otp: faker.random.numeric(6).toString()
    })

    const invalidTicketState: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: { failed: 'server' } } })
    )

    expect(invalidTicketState.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "no-mfa-ticket",
          "message": "No MFA ticket has been provided",
          "status": 10,
        },
      }
    `)
  })

  test(`should fail if TOTP is invalid`, async () => {
    server.use(mfaTotpInvalidOtpHandler)

    authService.send({
      type: 'SIGNIN_MFA_TOTP',
      ticket: `mfaTotp:${faker.datatype.uuid()}`,
      otp: faker.random.numeric(6).toString()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: { failed: 'server' } } })
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-otp",
          "message": "Invalid or expired OTP",
          "status": 401,
        },
      }
    `)
  })

  test(`should succeed if the provided MFA ticket and TOTP were valid`, async () => {
    authService.send({
      type: 'SIGNIN_MFA_TOTP',
      ticket: `mfaTotp:${faker.datatype.uuid()}`,
      otp: faker.random.numeric(6).toString()
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})
