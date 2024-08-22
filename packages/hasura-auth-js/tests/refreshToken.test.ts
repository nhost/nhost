import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { InterpreterFrom, interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import {
  AuthMachine,
  INVALID_REFRESH_TOKEN,
  NHOST_JWT_EXPIRES_AT_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  TOKEN_REFRESH_MARGIN_SECONDS,
  createAuthMachine
} from '../src'
import { BASE_URL } from './helpers/config'
import {
  authTokenInternalErrorHandler,
  authTokenNetworkErrorHandler,
  authTokenSuccessHandler,
  authTokenUnauthorizedHandler
} from './helpers/handlers'
import contextWithUser from './helpers/mocks/contextWithUser'
import fakeUser from './helpers/mocks/user'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe(`Token refresh behaviour on first start`, () => {
  let authMachine: AuthMachine
  let authService: InterpreterFrom<AuthMachine>

  beforeAll(() => {
    authMachine = createAuthMachine({
      backendUrl: BASE_URL,
      clientUrl: 'http://localhost:3000',
      refreshIntervalTime: 1,
      autoSignIn: true
    })
    authService = interpret(authMachine)
  })

  afterEach(() => {
    server.resetHandlers()
    authService.stop()
  })

  test('should start with the right state when no refresh token is given', async () => {
    authService.start()
    const state = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
    )
    expect(state.context.errors).toEqual({})
  })
})

describe(`Time based token refresh`, () => {
  const initialToken = faker.datatype.uuid()
  const initialExpiration = faker.date.future()
  const customStorage = new CustomClientStorage(new Map())

  const authMachineWithInitialSession = createAuthMachine({
    backendUrl: BASE_URL,
    clientUrl: 'http://localhost:3000',
    clientStorage: customStorage,
    clientStorageType: 'custom',
    autoSignIn: false
  }).withContext({
    ...contextWithUser,
    accessToken: {
      value: initialToken,
      expiresAt: initialExpiration,
      expiresInSeconds: 900
    }
  })

  const authServiceWithInitialSession = interpret(authMachineWithInitialSession)

  beforeEach(() => {
    customStorage.setItem(NHOST_JWT_EXPIRES_AT_KEY, faker.date.future().toISOString())
    customStorage.setItem(NHOST_REFRESH_TOKEN_KEY, faker.datatype.uuid())
    authServiceWithInitialSession.start()
  })

  afterEach(() => {
    authServiceWithInitialSession.stop()
    customStorage.clear()
    server.resetHandlers()
  })

  test(`token refresh should fail and sign out the user when the server returns an unauthorized error`, async () => {
    server.use(authTokenUnauthorizedHandler)

    // Fast forwarding to initial expiration date
    vi.setSystemTime(initialExpiration)

    const state = await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'refreshing' } } } })
    )

    expect(state.matches({ authentication: 'signedOut' }))
  })

  test(`access token should always be refreshed when reaching the expiration margin`, async () => {
    // Fast forward to the initial expiration date
    vi.setSystemTime(new Date(initialExpiration.getTime() - TOKEN_REFRESH_MARGIN_SECONDS * 1000))

    await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'refreshing' } } } })
    )

    const firstRefreshState = await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    const firstRefreshAccessToken = firstRefreshState.context.accessToken.value
    const firstRefreshAccessTokenExpiration = firstRefreshState.context.accessToken.expiresAt!

    expect(firstRefreshAccessToken).not.toBeNull()
    expect(firstRefreshAccessToken).not.toBe(initialToken)
    expect(firstRefreshAccessTokenExpiration?.getTime()).toBeGreaterThan(
      initialExpiration.getTime()
    )

    // Fast forward to the expiration date of the access token
    vi.setSystemTime(
      new Date(firstRefreshAccessTokenExpiration.getTime() - TOKEN_REFRESH_MARGIN_SECONDS * 1000)
    )

    await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'refreshing' } } } })
    )

    const secondRefreshState = await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    const secondRefreshAccessToken = secondRefreshState.context.accessToken.value
    const secondRefreshAccessTokenExpiration = secondRefreshState.context.accessToken.expiresAt!

    expect(secondRefreshAccessToken).not.toBeNull()
    expect(secondRefreshAccessToken).not.toBe(firstRefreshAccessToken)
    expect(secondRefreshAccessTokenExpiration.getTime()).toBeGreaterThan(
      firstRefreshAccessTokenExpiration.getTime()
    )

    // Fast forward to a time when the access token is still valid, so nothing should be refreshed
    vi.setSystemTime(
      new Date(
        secondRefreshAccessTokenExpiration.getTime() - TOKEN_REFRESH_MARGIN_SECONDS * 5 * 1000
      )
    )

    const thirdRefreshState = await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    const thirdRefreshAccessToken = thirdRefreshState.context.accessToken.value
    const thirdRefreshAccessTokenExpiration = thirdRefreshState.context.accessToken.expiresAt!

    expect(thirdRefreshAccessToken).toBe(secondRefreshAccessToken)
    expect(thirdRefreshAccessTokenExpiration.getTime()).toBe(
      thirdRefreshAccessTokenExpiration.getTime()
    )
  })

  test(`token should be refreshed every N seconds based on the refresh interval`, async () => {
    const refreshIntervalTime = faker.datatype.number({ min: 1000, max: 1500 })

    const authMachineWithInitialSession = createAuthMachine({
      backendUrl: BASE_URL,
      clientUrl: 'http://localhost:3000',
      clientStorage: customStorage,
      clientStorageType: 'custom',
      refreshIntervalTime,
      autoSignIn: false
    }).withContext({
      ...contextWithUser,
      accessToken: {
        value: initialToken,
        expiresAt: initialExpiration,
        expiresInSeconds: 900
      }
    })

    const authServiceWithInitialSession = interpret(authMachineWithInitialSession).start()

    // Fast N seconds to the refresh interval
    vi.setSystemTime(new Date(Date.now() + refreshIntervalTime * 1000))

    await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'refreshing' } } } })
    )

    const firstRefreshState = await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(firstRefreshState.context.accessToken.value).not.toBeNull()
    expect(firstRefreshState.context.accessToken.value).not.toBe(initialToken)

    // Fast N seconds to the refresh interval
    vi.setSystemTime(new Date(Date.now() + refreshIntervalTime * 1000))

    await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'refreshing' } } } })
    )

    const secondRefreshState = await waitFor(authServiceWithInitialSession, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(secondRefreshState.context.accessToken.value).not.toBeNull()
    expect(secondRefreshState.context.accessToken.value).not.toBe(
      firstRefreshState.context.accessToken.value
    )

    authServiceWithInitialSession.stop()
  })
})

describe('General and disabled auto-sign in', () => {
  const customStorage = new CustomClientStorage(new Map())

  customStorage.setItem(NHOST_JWT_EXPIRES_AT_KEY, faker.date.future().toISOString())
  customStorage.setItem(NHOST_REFRESH_TOKEN_KEY, faker.datatype.uuid())

  const authMachine = createAuthMachine({
    backendUrl: BASE_URL,
    clientUrl: 'http://localhost:3000',
    clientStorage: customStorage,
    clientStorageType: 'custom',
    refreshIntervalTime: 10,
    autoSignIn: false
  })

  const authService = interpret(authMachine)

  beforeEach(() => {
    authService.start()
  })

  afterEach(() => {
    authService.stop()
    customStorage.clear()
    server.resetHandlers()
  })

  test(`should retry token refresh if refresh endpoint is unreachable`, async () => {
    const user = { ...fakeUser }
    const accessToken = faker.datatype.string(40)
    const refreshToken = faker.datatype.uuid()
    const accessTokenExpiresIn = 900

    server.use(authTokenNetworkErrorHandler)

    authService.send({
      type: 'SESSION_UPDATE',
      data: {
        session: {
          accessToken,
          accessTokenExpiresIn,
          refreshToken,
          user
        }
      }
    })

    // Fast forward to a time when the access token is already expired
    vi.setSystemTime(Date.now() + accessTokenExpiresIn * 1.5 * 1000)

    const state = await waitFor(authService, (state) => state.context.refreshTimer.attempts > 0)
    expect(state.context.refreshTimer.attempts).toBeGreaterThan(0)
  }, 8000)

  test(`should save provided session on session update`, async () => {
    const user = { ...fakeUser }
    const accessToken = faker.datatype.string(40)
    const refreshToken = faker.datatype.uuid()

    expect(authService.getSnapshot().context.user).toBeNull()
    expect(authService.getSnapshot().context.accessToken.value).toBeNull()
    expect(authService.getSnapshot().context.refreshToken.value).toBeNull()

    authService.send({
      type: 'SESSION_UPDATE',
      data: {
        session: {
          accessToken,
          accessTokenExpiresIn: 900,
          refreshToken,
          user
        }
      }
    })

    const state = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).toMatchObject(user)
    expect(state.context.accessToken.value).toBe(accessToken)
    expect(state.context.accessToken.expiresAt).not.toBeNull()
    expect(state.context.refreshToken.value).toBe(refreshToken)
  })

  test(`should automatically refresh token if expiration date was not part in session`, async () => {
    const user = { ...fakeUser }
    const accessToken = faker.datatype.string(40)
    const refreshToken = faker.datatype.uuid()

    authService.send({
      type: 'SESSION_UPDATE',
      data: {
        session: {
          user,
          accessTokenExpiresIn: 0,
          accessToken,
          refreshToken
        }
      }
    })

    const state = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    // Note: Access token must have been refreshed
    expect(state.context.accessToken).not.toBeNull()
    expect(state.context.accessToken).not.toBe(accessToken)

    // Note: JWT expiration date must have been updated in the storage
    expect(customStorage.getItem(NHOST_JWT_EXPIRES_AT_KEY)).not.toBeNull()
  })

  test(`should fail if network is unavailable`, async () => {
    server.use(authTokenNetworkErrorHandler)

    authService.send({ type: 'TRY_TOKEN', token: faker.datatype.uuid() })

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

  test(`should fail if refresh token is invalid`, async () => {
    server.use(authTokenUnauthorizedHandler)

    authService.send({ type: 'TRY_TOKEN', token: faker.datatype.uuid() })

    const state = await waitFor(authService, (state) =>
      state.matches('authentication.signedOut.failed')
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-refresh-token",
          "message": "Invalid or expired refresh token",
          "status": 401,
        },
      }
    `)
  })

  test(`should succeed if a valid custom token is provided`, async () => {
    authService.send({ type: 'TRY_TOKEN', token: faker.datatype.uuid() })

    const state = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})

describe(`Auto sign-in`, () => {
  const customStorage = new CustomClientStorage(new Map())

  let authMachine: AuthMachine
  let authService: InterpreterFrom<AuthMachine>

  const originalLocation = { ...global.location }

  beforeAll(() => {
    customStorage.setItem(NHOST_JWT_EXPIRES_AT_KEY, faker.date.future().toISOString())
    customStorage.setItem(NHOST_REFRESH_TOKEN_KEY, faker.datatype.uuid())

    authMachine = createAuthMachine({
      backendUrl: BASE_URL,
      clientUrl: 'http://localhost:3000',
      clientStorage: customStorage,
      clientStorageType: 'custom',
      refreshIntervalTime: 1,
      autoSignIn: true
    })

    authService = interpret(authMachine)
  })

  afterEach(() => {
    server.resetHandlers()
    authService.stop()
    customStorage.clear()
    // * Stubbed global is not restored after `vi.restoreAllMocks`. Restoring it manually
    vi.stubGlobal('location', originalLocation)
    vi.restoreAllMocks()
  })

  test(`should throw an error if "error" was in the URL when opening the application`, async () => {
    // Scenario 1: Testing when `errorDescription` is provided.
    vi.stubGlobal('location', {
      ...globalThis.location,
      href: `http://localhost:3000/?error=${INVALID_REFRESH_TOKEN.error}&errorDescription=${INVALID_REFRESH_TOKEN.message}`
    })
    authService.start()
    const firstState = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
    )

    expect(firstState.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-refresh-token",
          "message": "Invalid or expired refresh token",
          "status": 10,
        },
      }
    `)

    authService.stop()

    // Scenario 2: Testing when `errorDescription` is not provided.
    vi.stubGlobal('location', {
      ...globalThis.location,
      href: `http://localhost:3000/?error=${INVALID_REFRESH_TOKEN.error}`
    })

    authService.start()

    const secondState = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
    )

    expect(secondState.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-refresh-token",
          "message": "invalid-refresh-token",
          "status": 10,
        },
      }
    `)
  })

  test(`should retry token refresh if network is unavailable`, async () => {
    server.use(authTokenNetworkErrorHandler)
    //
    vi.stubGlobal('location', {
      ...globalThis.location,
      href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
    })

    authService.start()

    const state = await waitFor(authService, (state) => state.context.importTokenAttempts === 2)

    expect(state.context.importTokenAttempts).toEqual(2)
  }, 20000)

  test(`should retry a token refresh if server returns an error`, async () => {
    server.use(authTokenInternalErrorHandler)

    vi.stubGlobal('location', {
      ...globalThis.location,
      href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
    })

    authService.start()

    const state = await waitFor(authService, (state) => state.context.importTokenAttempts === 2)

    expect(state.context.importTokenAttempts).toEqual(2)
  }, 20000)

  test(`should wait for the server to be online when starting offline`, async () => {
    server.use(authTokenInternalErrorHandler)

    vi.stubGlobal('location', {
      ...globalThis.location,
      href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
    })

    authService.start()

    const offlineState = await waitFor(
      authService,
      (state) => state.context.importTokenAttempts === 2
    )

    expect(offlineState.context.importTokenAttempts).toEqual(2)

    server.use(authTokenSuccessHandler)

    const signedInState = await waitFor(authService, (state) =>
      state.matches('authentication.signedIn')
    )
    expect(signedInState.context.user).not.toBeNull()
  }, 20000)

  test(`should automatically sign in if "refreshToken" was in the URL`, async () => {
    vi.stubGlobal('location', {
      ...globalThis.location,
      href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
    })

    authService.start()

    const state = await waitFor(authService, (state) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})
