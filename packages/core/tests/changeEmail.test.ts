import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthClient } from '../src/client'
import { INVALID_EMAIL_ERROR } from '../src/errors'
import { createAuthMachine, createChangeEmailMachine } from '../src/machines'
import { INITIAL_MACHINE_CONTEXT } from '../src/machines/context'
import { Typegen0 } from '../src/machines/reset-password.typegen'
import { BASE_URL } from './helpers/config'
import { changeEmailInternalErrorHandler, changeEmailNetworkErrorHandler } from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralChangeEmailState } from './helpers/types'
import fakeUser from './helpers/__mocks__/user'

type ChangeEmailState = GeneralChangeEmailState<Typegen0>

const customStorage = new CustomClientStorage(new Map())

const authClient = new AuthClient({
  backendUrl: BASE_URL,
  clientUrl: 'http://localhost:3000'
})

authClient.interpreter = interpret(
  createAuthMachine({ backendUrl: BASE_URL, clientUrl: 'http://localhost:3000' }).withContext({
    ...INITIAL_MACHINE_CONTEXT,
    user: fakeUser,
    accessToken: {
      value: faker.datatype.string(40),
      expiresAt: faker.date.future()
    },
    refreshToken: { value: faker.datatype.uuid() }
  })
).start()

const changeEmailMachine = createChangeEmailMachine(authClient)
const changeEmailService = interpret(changeEmailMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  changeEmailService.start()
})

afterEach(() => {
  changeEmailService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if there is a network error`, async () => {
  server.use(changeEmailNetworkErrorHandler)

  changeEmailService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: ChangeEmailState = await waitFor(changeEmailService, (state: ChangeEmailState) =>
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
  server.use(changeEmailInternalErrorHandler)

  changeEmailService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: ChangeEmailState = await waitFor(changeEmailService, (state: ChangeEmailState) =>
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
  changeEmailService.send({
    type: 'REQUEST',
    email: faker.internet.userName()
  })

  const state: ChangeEmailState = await waitFor(changeEmailService, (state: ChangeEmailState) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchObject(INVALID_EMAIL_ERROR)
})

test(`should succeed if email is valid`, async () => {
  changeEmailService.send({ type: 'REQUEST', email: faker.internet.email() })

  const state: ChangeEmailState = await waitFor(changeEmailService, (state: ChangeEmailState) =>
    state.matches({ idle: 'success' })
  )

  expect(state.context.error).toBeNull()
})
