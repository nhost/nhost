import faker from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from 'vitest'
import { BaseActionObject, interpret, Interpreter, ResolveTypegenMeta, ServiceMap } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { NHOST_JWT_EXPIRES_AT_KEY, NHOST_REFRESH_TOKEN_KEY } from '../src/constants'
import { INVALID_REFRESH_TOKEN } from '../src/errors'
import { AuthContext, AuthEvents, createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import {
  authTokenInternalErrorHandler,
  authTokenNetworkErrorHandler,
  authTokenUnauthorizedHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'
import fakeUser from './helpers/__mocks__/user'

type AuthState = GeneralAuthState<Typegen0>

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

  test(`should save provided session on session update`, async () => {
    const user = { ...fakeUser }
    const accessToken = faker.datatype.string(40)
    const refreshToken = faker.datatype.uuid()

    expect(authService.state.context.user).toBeNull()
    expect(authService.state.context.accessToken.value).toBeNull()
    expect(authService.state.context.refreshToken.value).toBeNull()

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

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
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
          accessTokenExpiresIn: null,
          accessToken,
          refreshToken
        }
      }
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
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

  test(`should fail if refresh token is invalid`, async () => {
    server.use(authTokenUnauthorizedHandler)

    authService.send({ type: 'TRY_TOKEN', token: faker.datatype.uuid() })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
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

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})

describe(`Auto sign-in`, () => {
  const customStorage = new CustomClientStorage(new Map())

  let authMachine: ReturnType<typeof createAuthMachine>
  let authService: Interpreter<
    AuthContext,
    any,
    AuthEvents,
    {
      value: any
      context: AuthContext
    },
    ResolveTypegenMeta<Typegen0, AuthEvents, BaseActionObject, ServiceMap>
  >

  const originalWindow = { ...global.window }
  let windowSpy: jest.SpyInstance

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })

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

  afterAll(() => server.close())

  beforeEach(() => {
    windowSpy = vi.spyOn(global, 'window', 'get')
  })

  afterEach(() => {
    server.resetHandlers()
    authService.stop()
    customStorage.clear()
    vi.restoreAllMocks()
  })

  test(`should throw an error if "error" was in the URL`, async () => {
    windowSpy.mockImplementation(() => ({
      ...originalWindow,
      location: {
        ...originalWindow.location,
        href: `http://localhost:3000/?error=${INVALID_REFRESH_TOKEN.error}&errorDescription=${INVALID_REFRESH_TOKEN.message}`
      }
    }))

    authService.start()

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "authentication": {
          "error": "invalid-refresh-token",
          "message": "Invalid or expired refresh token",
          "status": 10,
        },
      }
    `)
  })

  test(`should fail if network is unavailable`, async () => {
    server.use(authTokenNetworkErrorHandler)

    windowSpy.mockImplementation(() => ({
      ...originalWindow,
      location: {
        ...originalWindow.location,
        href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
      }
    }))

    authService.start()

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
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
    server.use(authTokenInternalErrorHandler)

    windowSpy.mockImplementation(() => ({
      ...originalWindow,
      location: {
        ...originalWindow.location,
        href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
      }
    }))

    authService.start()

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: 'noErrors' } })
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

  test(`should automatically sign in if "refreshToken" was in the URL`, async () => {
    windowSpy.mockImplementation(() => ({
      ...originalWindow,
      location: {
        ...originalWindow.location,
        href: `http://localhost:3000/?refreshToken=${faker.datatype.uuid()}`
      }
    }))

    authService.start()

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})
