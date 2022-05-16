import faker from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, describe, test, vi } from 'vitest'
import { BaseActionObject, interpret, Interpreter, ResolveTypegenMeta, ServiceMap } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { NHOST_JWT_EXPIRES_AT_KEY, NHOST_REFRESH_TOKEN_KEY } from '../src/constants'
import { INVALID_REFRESH_TOKEN } from '../src/errors'
import { AuthContext, AuthEvents, createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import { authTokenInternalErrorHandler, authTokenNetworkErrorHandler } from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'
import fakeUser from './helpers/__mocks__/user'

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
  expect(state.context.refreshToken.value).toBe(refreshToken)
})

describe(`Auto sign-in`, () => {
  let autoSignInAuthMachine: ReturnType<typeof createAuthMachine>
  let autoSignInAuthService: Interpreter<
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
    customStorage.setItem(NHOST_JWT_EXPIRES_AT_KEY, '1')
    customStorage.setItem(NHOST_REFRESH_TOKEN_KEY, '1')

    autoSignInAuthMachine = createAuthMachine({
      backendUrl: BASE_URL,
      clientUrl: 'http://localhost:3000',
      clientStorage: customStorage,
      clientStorageType: 'custom',
      refreshIntervalTime: 1,
      autoSignIn: true
    })

    autoSignInAuthService = interpret(autoSignInAuthMachine)
  })

  beforeEach(() => {
    windowSpy = vi.spyOn(global, 'window', 'get')
  })

  afterEach(() => {
    autoSignInAuthService.stop()
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

    autoSignInAuthService.start()

    const state: AuthState = await waitFor(autoSignInAuthService, (state: AuthState) =>
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

    autoSignInAuthService.start()

    const state: AuthState = await waitFor(autoSignInAuthService, (state: AuthState) =>
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

    autoSignInAuthService.start()

    const state: AuthState = await waitFor(autoSignInAuthService, (state: AuthState) =>
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

    autoSignInAuthService.start()

    const state: AuthState = await waitFor(autoSignInAuthService, (state: AuthState) =>
      state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
    )

    expect(state.context.user).not.toBeNull()
  })
})
