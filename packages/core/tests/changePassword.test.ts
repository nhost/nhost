import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthClient } from '../src/client'
import { INVALID_PASSWORD_ERROR } from '../src/errors'
import { createAuthMachine, createChangePasswordMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/change-password.typegen'
import { INITIAL_MACHINE_CONTEXT } from '../src/machines/context'
import { BASE_URL } from './helpers/config'
import {
  changePasswordInternalErrorHandler,
  changePasswordNetworkErrorHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralChangePasswordState } from './helpers/types'
import fakeUser from './helpers/__mocks__/user'

type ChangePasswordState = GeneralChangePasswordState<Typegen0>

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

  const state: ChangePasswordState = await waitFor(
    changePasswordService,
    (state: ChangePasswordState) => state.matches({ idle: 'error' })
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
  server.use(changePasswordInternalErrorHandler)

  changePasswordService.send({
    type: 'REQUEST',
    password: faker.internet.password(15)
  })

  const state: ChangePasswordState = await waitFor(
    changePasswordService,
    (state: ChangePasswordState) => state.matches({ idle: 'error' })
  )

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

  const state: ChangePasswordState = await waitFor(
    changePasswordService,
    (state: ChangePasswordState) => state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchObject(INVALID_PASSWORD_ERROR)
})

test(`should succeed if password is valid`, async () => {
  changePasswordService.send({
    type: 'REQUEST',
    password: faker.internet.password(15)
  })

  const state: ChangePasswordState = await waitFor(
    changePasswordService,
    (state: ChangePasswordState) => state.matches({ idle: 'success' })
  )

  expect(state.context.error).toBeNull()
})
