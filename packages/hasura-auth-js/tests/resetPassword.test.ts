import { faker } from '@faker-js/faker'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthClient, createResetPasswordMachine, INVALID_EMAIL_ERROR } from '../src'
import { BASE_URL } from './helpers/config'
import {
  resetPasswordInternalErrorHandler,
  resetPasswordNetworkErrorHandler,
  resetPasswordUserNotFoundHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

const customStorage = new CustomClientStorage(new Map())

const resetPasswordMachine = createResetPasswordMachine(
  new AuthClient({
    backendUrl: BASE_URL,
    clientUrl: 'http://localhost:3000',
    start: false
  })
)

const resetPasswordService = interpret(resetPasswordMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  resetPasswordService.start()
})

afterEach(() => {
  resetPasswordService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if there is a network error`, async () => {
  server.use(resetPasswordNetworkErrorHandler)

  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state = await waitFor(resetPasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "network",
      "message": "Network Error",
      "status": 0,
    }
  `)
})

test(`should fail if server returns an error`, async () => {
  server.use(resetPasswordInternalErrorHandler)

  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state = await waitFor(resetPasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "internal-error",
      "message": "Internal error",
      "status": 500,
    }
  `)
})

test(`should fail if email is invalid`, async () => {
  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.userName()
  })

  const state = await waitFor(resetPasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchObject(INVALID_EMAIL_ERROR)
})

test(`should fail if user is not found`, async () => {
  server.use(resetPasswordUserNotFoundHandler)

  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state = await waitFor(resetPasswordService, (state) => state.matches({ idle: 'error' }))

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "user-not-found",
      "message": "No user found",
      "status": 400,
    }
  `)
})

test(`should succeed if email is valid`, async () => {
  resetPasswordService.send({ type: 'REQUEST', email: faker.internet.email() })

  const state = await waitFor(resetPasswordService, (state) => state.matches({ idle: 'success' }))

  expect(state.context.error).toBeNull()
})
