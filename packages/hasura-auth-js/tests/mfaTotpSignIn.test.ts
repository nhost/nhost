import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src'
import { BASE_URL } from './helpers/config'
import {
  mfaTotpInternalErrorHandler,
  mfaTotpInvalidOtpHandler,
  mfaTotpNetworkErrorHandler
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
  server.use(mfaTotpNetworkErrorHandler)

  authService.send({
    type: 'SIGNIN_MFA_TOTP',
    ticket: `mfaTotp:${faker.datatype.uuid()}`,
    otp: faker.random.numeric(6).toString()
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
  server.use(mfaTotpInternalErrorHandler)

  authService.send({
    type: 'SIGNIN_MFA_TOTP',
    ticket: `mfaTotp:${faker.datatype.uuid()}`,
    otp: faker.random.numeric(6).toString()
  })

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

test(`should fail if MFA ticket is not provided or invalid`, async () => {
  authService.send({
    type: 'SIGNIN_MFA_TOTP',
    ticket: '',
    otp: faker.random.numeric(6).toString()
  })

  const noTicketState = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
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
    ticket: faker.datatype.uuid(),
    otp: faker.random.numeric(6).toString()
  })

  const invalidTicketState = await waitFor(authService, (state) =>
    state.matches('authentication.signedOut.failed')
  )

  expect(invalidTicketState.context.errors).toMatchInlineSnapshot(`
    {
      "authentication": {
        "error": "invalid-mfa-ticket",
        "message": "MFA ticket is invalid",
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

  const state = await waitFor(authService, (state) =>
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

test(`should succeed if the provided MFA ticket and TOTP were valid`, async () => {
  authService.send({
    type: 'SIGNIN_MFA_TOTP',
    ticket: `mfaTotp:${faker.datatype.uuid()}`,
    otp: faker.random.numeric(6).toString()
  })

  const state = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(state.context.user).not.toBeNull()
})

test(`should succeed if MFA ticket is already in context and TOTP was valid`, async () => {
  authService.getSnapshot().context.mfa = { ticket: `mfaTotp:${faker.datatype.uuid()}` }

  authService.send({
    type: 'SIGNIN_MFA_TOTP',
    otp: faker.random.numeric(6).toString()
  })

  const state = await waitFor(authService, (state) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(state.context.user).not.toBeNull()
})
