import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createAuthMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/index.typegen'
import { BASE_URL } from './helpers/config'
import { signUpNetworkErrorHandler } from './helpers/handlers'
import server from './helpers/server'
import customStorage from './helpers/storage'
import { GeneralAuthState } from './helpers/types'

type AuthState = GeneralAuthState<Typegen0>

// Initialzing AuthMachine with custom storage to have control over its content between tests
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

describe(`Sign up`, () => {
  test(`should fail if network is unavailable`, async () => {
    server.use(signUpNetworkErrorHandler)

    authService.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email: faker.internet.email(),
      password: faker.internet.password(15)
    })

    const state: AuthState = await waitFor(authService, (state: AuthState) =>
      state.matches({ authentication: { signedOut: { failed: 'server' } } })
    )

    expect(state.context.errors).toMatchInlineSnapshot(`
      {
        "registration": {
          "error": "OK",
          "message": "Network Error",
          "status": 200,
        },
      }
    `)
  })

  test.skip(`should fail if server returns an error`, async () => {})
  test.skip(`should fail if either email or password is incorrectly formatted`, async () => {})
  test.skip(`should succeed if email and password are correctly formatted`, async () => {})
})
