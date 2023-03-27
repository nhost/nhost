import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  passwordlessSmsInternalErrorHandler,
  passwordlessSmsNetworkErrorHandler
} from './helpers/handlers'
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
  server.use(passwordlessSmsNetworkErrorHandler)

  authService.send({
    type: 'PASSWORDLESS_SMS',
    phoneNumber: faker.phone.number()
  })

  const state = await waitFor(authService, (state) =>
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
  server.use(passwordlessSmsInternalErrorHandler)

  authService.send({
    type: 'PASSWORDLESS_SMS',
    phoneNumber: faker.phone.number()
  })

  const state = await waitFor(authService, (state) =>
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

test(`should fail if the provided phone number was invalid`, async () => {
  authService.send({
    type: 'PASSWORDLESS_SMS',
    // TODO: Phone number validation is not implemented yet
    phoneNumber: ''
  })

  const state = await waitFor(authService, (state) =>
    state.matches('registration.incomplete.failed')
  )

  expect(state.context.errors).toMatchInlineSnapshot(`
        {
          "registration": {
            "error": "invalid-phone-number",
            "message": "Phone number is incorrectly formatted",
            "status": 10,
          },
        }
        `)
})

test(`should succeed if the provided phone number was valid`, async () => {
  authService.send({
    type: 'PASSWORDLESS_SMS',
    phoneNumber: faker.phone.number()
  })

  const state = await waitFor(authService, (state) =>
    state.matches('registration.incomplete.needsOtp')
  )

  expect(state.context.user).toBeNull()
  expect(state.context.errors).toMatchInlineSnapshot(`{}`)
})
