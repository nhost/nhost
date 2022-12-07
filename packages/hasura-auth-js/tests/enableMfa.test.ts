import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import {
  AuthClient,
  createAuthMachine,
  createEnableMfaMachine,
  INVALID_MFA_CODE_ERROR,
  INVALID_MFA_TYPE_ERROR
} from '../src'
import { BASE_URL } from './helpers/config'
import {
  activateMfaTotpInternalErrorHandler,
  activateMfaTotpNetworkErrorHandler,
  activateMfaTotpUnauthorizedErrorHandler,
  generateMfaTotpInternalErrorHandler,
  generateMfaTotpNetworkErrorHandler,
  generateMfaTotpUnauthorizedErrorHandler
} from './helpers/handlers'
import contextWithUser from './helpers/mocks/contextWithUser'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

const customStorage = new CustomClientStorage(new Map())

const authClient = new AuthClient({
  backendUrl: BASE_URL,
  clientUrl: 'http://localhost:3000',
  start: false
})

// Adding state machine with pre-existing user to the client
authClient.start({
  interpreter: interpret(
    createAuthMachine({
      backendUrl: BASE_URL,
      clientUrl: 'http://localhost:3000',
      clientStorageType: 'custom',
      clientStorage: customStorage
    }).withContext(contextWithUser)
  )
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe(`Generation`, () => {
  const enableMfaMachine = createEnableMfaMachine(authClient)
  const enableMfaService = interpret(enableMfaMachine)

  beforeEach(() => {
    enableMfaService.start()
  })

  afterEach(() => {
    enableMfaService.stop()
    customStorage.clear()
    server.resetHandlers()
  })

  test(`should fail if network is unavailable`, async () => {
    server.use(generateMfaTotpNetworkErrorHandler)

    enableMfaService.send('GENERATE')

    const state = await waitFor(enableMfaService, (state) => state.matches({ idle: 'error' }))

    expect(state.context.error).toMatchInlineSnapshot(`
      {
        "error": "network",
        "message": "Network Error",
        "status": 0,
      }
    `)
  })

  test(`should fail if server returns an error`, async () => {
    server.use(generateMfaTotpInternalErrorHandler)

    enableMfaService.send('GENERATE')

    const state = await waitFor(enableMfaService, (state) => state.matches({ idle: 'error' }))

    expect(state.context.error).toMatchInlineSnapshot(`
      {
        "error": "internal-error",
        "message": "Internal error",
        "status": 500,
      }
    `)
  })

  test(`should fail if authorization token is invalid`, async () => {
    server.use(generateMfaTotpUnauthorizedErrorHandler)

    enableMfaService.send('GENERATE')

    const state = await waitFor(enableMfaService, (state) => state.matches({ idle: 'error' }))

    expect(state.context.error).toMatchInlineSnapshot(`
      {
        "error": "unauthenticated-user",
        "message": "User is not logged in",
        "status": 401,
      }
    `)
  })

  test(`should succeed if authorization token is valid`, async () => {
    enableMfaService.send('GENERATE')

    const state = await waitFor(enableMfaService, (state) => state.matches({ generated: 'idle' }))

    expect(state.context.error).toBeNull()
    expect(state.context.secret).toBeTypeOf('string')
    expect(state.context.imageUrl).toBeTypeOf('string')
  })
})

describe(`Activation`, () => {
  const enableMfaMachine = createEnableMfaMachine(authClient)
  const enableMfaService = interpret(enableMfaMachine)

  /**
   * Simulate MFA TOTP generation.
   */
  function simulateGenerateMfaTotp() {
    enableMfaService.send('GENERATE')

    return waitFor(enableMfaService, (state) => state.matches({ generated: 'idle' }))
  }

  beforeEach(() => {
    enableMfaService.start()
  })

  afterEach(() => {
    enableMfaService.stop()
    customStorage.clear()
    server.resetHandlers()
  })

  test(`should not do anything if MFA TOTP has not been generated yet`, () => {
    enableMfaService.send('ACTIVATE')

    expect(enableMfaService.getSnapshot().matches('idle')).toBeTruthy()
  })

  test(`should fail if network is unavailable`, async () => {
    server.use(activateMfaTotpNetworkErrorHandler)

    await simulateGenerateMfaTotp()

    enableMfaService.send({ type: 'ACTIVATE', activeMfaType: 'totp' })

    const state = await waitFor(enableMfaService, (state) =>
      state.matches({ generated: { idle: 'error' } })
    )

    expect(state.context.error).toMatchInlineSnapshot(`
      {
        "error": "invalid-mfa-code",
        "message": "MFA code is invalid",
        "status": 10,
      }
    `)
  })

  test(`should fail if server returns an error`, async () => {
    server.use(activateMfaTotpInternalErrorHandler)

    await simulateGenerateMfaTotp()

    enableMfaService.send({ type: 'ACTIVATE', activeMfaType: 'totp' })

    const state = await waitFor(enableMfaService, (state) =>
      state.matches({ generated: { idle: 'error' } })
    )

    expect(state.context.error).toMatchInlineSnapshot(`
      {
        "error": "invalid-mfa-code",
        "message": "MFA code is invalid",
        "status": 10,
      }
    `)
  })

  test(`should fail if authorization token is invalid`, async () => {
    server.use(activateMfaTotpUnauthorizedErrorHandler)

    await simulateGenerateMfaTotp()

    enableMfaService.send({ type: 'ACTIVATE', activeMfaType: 'totp' })

    const state = await waitFor(enableMfaService, (state) =>
      state.matches({ generated: { idle: 'error' } })
    )

    expect(state.context.error).toMatchInlineSnapshot(`
      {
        "error": "invalid-mfa-code",
        "message": "MFA code is invalid",
        "status": 10,
      }
    `)
  })

  test(`should fail if TOTP is not provided`, async () => {
    await simulateGenerateMfaTotp()

    enableMfaService.send('ACTIVATE')

    const state = await waitFor(enableMfaService, (state) =>
      state.matches({ generated: { idle: 'error' } })
    )

    expect(state.context.error).toMatchObject(INVALID_MFA_TYPE_ERROR)
  })

  test(`should fail if no code is provided`, async () => {
    await simulateGenerateMfaTotp()

    enableMfaService.send({ type: 'ACTIVATE', code: '', activeMfaType: 'totp' })

    const state = await waitFor(enableMfaService, (state) =>
      state.matches({ generated: { idle: 'error' } })
    )

    expect(state.context.error).toMatchObject(INVALID_MFA_CODE_ERROR)
  })

  test(`should succeed if a signed-in user provided a valid TOTP`, async () => {
    await simulateGenerateMfaTotp()

    enableMfaService.send({
      type: 'ACTIVATE',
      code: faker.datatype.string(6),
      activeMfaType: 'totp'
    })

    const state = await waitFor(enableMfaService, (state) =>
      state.matches({ generated: 'activated' })
    )

    expect(state.context.error).toBeNull()
  })
})
