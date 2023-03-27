import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  authTokenNetworkErrorHandler,
  correctEmailPasswordWithMfaHandler,
  emailPasswordNetworkErrorHandler,
  incorrectEmailPasswordHandler,
  unverifiedEmailErrorHandler
} from './helpers/handlers'
import contextWithUser from './helpers/mocks/contextWithUser'
import fakeUser from './helpers/mocks/user'
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

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

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
  server.use(emailPasswordNetworkErrorHandler, authTokenNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

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

test(`should fail if either email or password is incorrectly formatted`, async () => {
  // Scenario 1: Providing an invalid email address with a valid password
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.userName(),
    password: faker.internet.password(15)
  })

  const emailErrorSignInState = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
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
  // Scenario 2: Providing a valid email address with an invalid password
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(2)
  })

  const passwordErrorSignInState = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(passwordErrorSignInState.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-password",
          "message": "Password is incorrectly formatted",
          "status": 10,
        },
      }
    `)
})

test(`should fail if incorrect credentials are provided`, async () => {
  server.use(incorrectEmailPasswordHandler)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  const state = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
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

test(`should fail if user email needs verification`, async () => {
  server.use(unverifiedEmailErrorHandler)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
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

test(`should save MFA ticket if MFA is set up for the account`, async () => {
  server.use(correctEmailPasswordWithMfaHandler)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  const signInPasswordState = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.needsMfa')
  )

  expect(signInPasswordState.context.mfa?.ticket).not.toBeNull()

  // Note: MFA ticket is already in context
  authService.send({
    type: 'SIGNIN_MFA_TOTP',
    otp: faker.random.numeric(6)
  })

  const mfaTotpState = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(mfaTotpState.context.user).not.toBeNull()
})

test(`should succeed if correct credentials are provided`, async () => {
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email(),
    password: faker.internet.password(15)
  })

  const state = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(state.context.user).not.toBeNull()
})

test(`should transition to signed in state if user is already signed in`, async () => {
  const user = { ...fakeUser }

  const authServiceWithInitialUser = interpret(authMachine.withContext(contextWithUser))

  authServiceWithInitialUser.start()

  const state = await waitFor(authServiceWithInitialUser, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(state.context.user).toMatchObject(user)

  authServiceWithInitialUser.stop()
})
