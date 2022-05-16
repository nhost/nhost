import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  passwordlessSmsInternalErrorHandler,
  passwordlessSmsNetworkErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import customStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'

type AuthState = GeneralAuthState<Typegen0>

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

test(`should fail if server returns an error`, async () => {
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
