import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  authTokenNetworkErrorHandler,
  emailPasswordNetworkErrorHandler,
} from './helpers/handlers'
import contextWithUser from './helpers/mocks/contextWithUser'
import fakeUser from './helpers/mocks/user'
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
  server.use(emailPasswordNetworkErrorHandler, authTokenNetworkErrorHandler)

  authService.send({ type: 'SIGNIN_ANONYMOUS' })

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
  server.use(emailPasswordNetworkErrorHandler, authTokenNetworkErrorHandler)

  authService.send({ type: 'SIGNIN_ANONYMOUS' })

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
// MFA
// change email
// change password
// reset password
// sign-in email + password
// sign-in email passwordless
// sign-in sms passwordless

test(`should transition to signed in state if user is already signed in`, async () => {
  const user = { ...fakeUser }

  const authServiceWithInitialUser = interpret(authMachine.withContext(contextWithUser))

  authServiceWithInitialUser.start()

  const state: AuthState = await waitFor(authServiceWithInitialUser, (state: AuthState) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(state.context.user).toMatchObject(user)

  authServiceWithInitialUser.stop()
})
