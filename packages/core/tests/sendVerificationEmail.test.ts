import { faker } from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthClient } from '../src/client'
import { INVALID_EMAIL_ERROR } from '../src/errors'
import { createSendVerificationEmailMachine } from '../src/machines'
import { BASE_URL } from './helpers/config'
import {
  sendVerificationEmailInternalErrorHandler,
  sendVerificationEmailNetworkErrorHandler,
  sendVerificationEmailUserNotFoundHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'

const customStorage = new CustomClientStorage(new Map())

const sendVerificationEmailMachine = createSendVerificationEmailMachine(
  new AuthClient({
    backendUrl: BASE_URL,
    clientUrl: 'http://localhost:3000',
    start: false
  })
)

const sendVerificationEmailService = interpret(sendVerificationEmailMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  sendVerificationEmailService.start()
})

afterEach(() => {
  sendVerificationEmailService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if there is a network error`, async () => {
  server.use(sendVerificationEmailNetworkErrorHandler)

  sendVerificationEmailService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state = await waitFor(sendVerificationEmailService, (state) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "OK",
      "message": "Network Error",
      "status": 200,
    }
  `)
})

test(`should fail if server returns an error`, async () => {
  server.use(sendVerificationEmailInternalErrorHandler)

  sendVerificationEmailService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state = await waitFor(sendVerificationEmailService, (state) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "internal-error",
      "message": "Internal error",
      "status": 500,
    }
  `)
})

test(`should fail if email is invalid`, async () => {
  sendVerificationEmailService.send({
    type: 'REQUEST',
    email: faker.internet.userName()
  })

  const state = await waitFor(sendVerificationEmailService, (state) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchObject(INVALID_EMAIL_ERROR)
})

test(`should fail if user is not found`, async () => {
  server.use(sendVerificationEmailUserNotFoundHandler)

  sendVerificationEmailService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state = await waitFor(sendVerificationEmailService, (state) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "user-not-found",
      "message": "No user found",
      "status": 400,
    }
  `)
})

test(`should succeed if email is valid`, async () => {
  sendVerificationEmailService.send({ type: 'REQUEST', email: faker.internet.email() })

  const state = await waitFor(sendVerificationEmailService, (state) =>
    state.matches({ idle: 'success' })
  )

  expect(state.context.error).toBeNull()
})
