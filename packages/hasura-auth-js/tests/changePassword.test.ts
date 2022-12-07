import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import {
  AuthClient,
  createAuthMachine,
  createChangePasswordMachine,
  INVALID_PASSWORD_ERROR
} from '../src'
import { BASE_URL } from './helpers/config'
import {
  changePasswordInternalErrorHandler,
  changePasswordNetworkErrorHandler
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

authClient.start({
  interpreter: interpret(
    createAuthMachine({
      backendUrl: BASE_URL,
      clientUrl: 'http://localhost:3000',
      clientStorage: customStorage,
      clientStorageType: 'custom'
    }).withContext(contextWithUser)
  )
})

const changePasswordMachine = createChangePasswordMachine(authClient)
const changePasswordService = interpret(changePasswordMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  changePasswordService.start()
})

afterEach(() => {
  changePasswordService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if there is a network error`, async () => {
  server.use(changePasswordNetworkErrorHandler)

  changePasswordService.send({
    type: 'REQUEST',
    password: faker.internet.password(15)
  })

  const state = await waitFor(changePasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "network",
      "message": "Network Error",
      "status": 0,
    }
  `)
})

test(`should fail if server returns an error`, async () => {
  server.use(changePasswordInternalErrorHandler)

  changePasswordService.send({
    type: 'REQUEST',
    password: faker.internet.password(15)
  })

  const state = await waitFor(changePasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "internal-error",
      "message": "Internal error",
      "status": 500,
    }
  `)
})

test(`should fail if password is invalid`, async () => {
  changePasswordService.send({
    type: 'REQUEST',
    password: faker.internet.password(2)
  })

  const state = await waitFor(changePasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchObject(INVALID_PASSWORD_ERROR)
})

test(`should succeed if password is valid`, async () => {
  changePasswordService.send({
    type: 'REQUEST',
    password: faker.internet.password(15)
  })

  const state = await waitFor(changePasswordService, (state) => state.matches({ idle: 'success' }))

  expect(state.context.error).toBeNull()
})
