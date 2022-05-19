import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { INVALID_EMAIL_ERROR } from '../src/errors'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  passwordlessEmailInternalErrorHandler,
  passwordlessEmailNetworkErrorHandler
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

test('should fail if network is unavailable', async () => {
  server.use(passwordlessEmailNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_PASSWORDLESS_EMAIL',
    email: faker.internet.email()
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
  server.use(passwordlessEmailInternalErrorHandler)

  authService.send({
    type: 'SIGNIN_PASSWORDLESS_EMAIL',
    email: faker.internet.email()
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

test(`should fail if the provided email address was invalid`, async () => {
  authService.send({
    type: 'SIGNIN_PASSWORDLESS_EMAIL',
    email: faker.internet.userName()
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-email",
          "message": "Email is incorrectly formatted",
          "status": 10,
        },
      }
    `)
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
})
