import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  anonymousInternalErrorHandler,
  anonymousNetworkErrorHandler,
  invalidDeamonymisationEmailError
} from './helpers/handlers'
import { fakeAnonymousUser } from './helpers/mocks/user'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

describe('Anonymous Sign-in', () => {
  const customStorage = new CustomClientStorage(new Map())

  const authMachine = createAuthMachine({
    backendUrl: BASE_URL,
    clientUrl: 'http://localhost:3000',
    clientStorage: customStorage,
    clientStorageType: 'custom'
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
    server.use(anonymousInternalErrorHandler)

    authService.send({ type: 'SIGNIN_ANONYMOUS' })

    const state = await waitFor(authService, (state) =>
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

  test('should deanonymise a user with email and password', async () => {
    authService.send({ type: 'SIGNIN_ANONYMOUS' })

    await waitFor(authService, (state) => state.matches('authentication.signedIn'))

    authService.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email: faker.internet.email(),
      password: faker.internet.password(15)
    })

    const state = await waitFor(authService, (state) =>
      state.matches({
        authentication: 'signedOut',
        registration: { incomplete: 'needsEmailVerification' }
      })
    )

    expect(state.context.user).toBeNull()
  })

  test('should deanonymise a user with passwordless email', async () => {
    authService.send({ type: 'SIGNIN_ANONYMOUS' })

    await waitFor(authService, (state) => state.matches('authentication.signedIn'))

    authService.send({
      type: 'PASSWORDLESS_EMAIL',
      email: faker.internet.email()
    })

    const state = await waitFor(authService, (state) =>
      state.matches({
        authentication: 'signedOut',
        registration: { incomplete: 'needsEmailVerification' }
      })
    )

    expect(state.context.user).toBeNull()
  })

  test('should deanonymise a user with passwordless sms', async () => {
    authService.send({ type: 'SIGNIN_ANONYMOUS' })

    await waitFor(authService, (state) => state.matches('authentication.signedIn'))

    authService.send({
      type: 'PASSWORDLESS_SMS',
      phoneNumber: faker.phone.number()
    })

    const state = await waitFor(authService, (state) =>
      state.matches({
        authentication: 'signedOut',
        registration: { incomplete: 'needsOtp' }
      })
    )

    expect(state.context.user).toBeNull()
  })

  test('should fail deanonymisation when using an invalid email', async () => {
    server.use(invalidDeamonymisationEmailError)
    authService.send({ type: 'SIGNIN_ANONYMOUS' })

    await waitFor(authService, (state) => state.matches('authentication.signedIn'))

    authService.send({
      type: 'PASSWORDLESS_EMAIL',
      email: 'invalid//email'
    })

    const state = await waitFor(authService, (state) =>
      state.matches({
        registration: { incomplete: 'failed' }
      })
    )

    expect(state.context.user).toMatchObject(fakeAnonymousUser)
  })
})
