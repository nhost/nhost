import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  passwordlessSmsOtpInternalErrorHandler,
  passwordlessSmsOtpInvalidOtpHandler,
  passwordlessSmsOtpNetworkErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'

type AuthState = GeneralAuthState<Typegen0>

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
  server.use(passwordlessSmsOtpNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
    phoneNumber: faker.phone.phoneNumber(),
    otp: faker.random.numeric(6).toString()
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches('authentication.signedOut.failed')
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
  server.use(passwordlessSmsOtpInternalErrorHandler)

  authService.send({
    type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
    phoneNumber: faker.phone.phoneNumber(),
    otp: faker.random.numeric(6).toString()
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
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

test(`should fail if the provided phone number was invalid`, async () => {
  authService.send({
    type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
    // TODO: Phone number validation is not implemented yet
    phoneNumber: '',
    otp: faker.random.numeric(6).toString()
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-phone-number\",
          "message": "Phone number is incorrectly formatted\",
          "status": 10,
        },
      }
    `)
})

test(`should fail if the provided OTP was invalid`, async () => {
  server.use(passwordlessSmsOtpInvalidOtpHandler)

  authService.send({
    type: 'SIGNIN_PASSWORDLESS_SMS_OTP',
    phoneNumber: faker.phone.phoneNumber(),
    otp: faker.random.numeric(6).toString()
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches('authentication.signedOut.failed')
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
