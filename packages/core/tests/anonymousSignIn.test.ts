import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  anonymousNetworkErrorHandler,
  correctAnonymousHandler,
  deamonymisationSuccessfulHandler
} from './helpers/handlers'
import fakeUser from './helpers/mocks/user'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'

type AuthState = GeneralAuthState<Typegen0>

const customStorage = new CustomClientStorage(new Map())

const authMachine = createAuthMachine({
  backendUrl: BASE_URL,
  clientUrl: 'http://localhost:3000'
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
  server.use(anonymousNetworkErrorHandler)

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
  server.use(anonymousNetworkErrorHandler)

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

test('should deanonymise a user with email and password', async () => {
  server.use(correctAnonymousHandler, deamonymisationSuccessfulHandler)
  authService.send({ type: 'SIGNIN_ANONYMOUS' })

  await waitFor(authService, (state: AuthState) => state.matches('authentication.signedIn'))

  authService.send({
    type: 'SIGNUP_EMAIL_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: 'signedIn', signUp: 'complete' })
  )

  expect(state.context.user).toMatchObject(fakeUser)
})

test('should deanonymise a user with passwordless', async () => {
  server.use(correctAnonymousHandler, deamonymisationSuccessfulHandler)
  authService.send({ type: 'SIGNIN_ANONYMOUS' })

  await waitFor(authService, (state: AuthState) => state.matches('authentication.signedIn'))

  authService.send({
    type: 'PASSWORDLESS_EMAIL',
    email: faker.internet.email()
  })

  const state: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: 'signedIn', signUp: 'complete' })
  )

  expect(state.context.user).toMatchObject(fakeUser)
})

// TODO look at the following cases
// MFA
// change email
// change password
// reset password
// sms passwordless
