import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { incorrectEmailPasswordHandler } from './helpers/signInHandlers'
import { AuthContext, AuthEvents, AuthMachine, createAuthMachine } from '../src/machines'
import {
  BaseActionObject,
  interpret,
  Interpreter,
  ResolveTypegenMeta,
  ServiceMap,
  State
} from 'xstate'
import { Typegen0 } from '../src/machines/index.typegen'
import faker from '@faker-js/faker'
import { waitFor } from 'xstate/lib/waitFor'
import server from './helpers/server'

type AuthState = State<
  AuthContext,
  AuthEvents,
  any,
  {
    value: any
    context: AuthContext
  },
  ResolveTypegenMeta<Typegen0, AuthEvents, BaseActionObject, ServiceMap>
>

let authMachine: AuthMachine
let authService: Interpreter<
  AuthContext,
  any,
  AuthEvents,
  { value: any; context: AuthContext },
  ResolveTypegenMeta<Typegen0, AuthEvents, BaseActionObject, ServiceMap>
>

beforeAll(() => server.listen())

beforeEach(() => {
  authMachine = createAuthMachine({
    backendUrl: 'http://localhost:1337/v1/auth',
    clientUrl: 'http://localhost:3000'
  })

  authService = interpret(authMachine).start(authMachine.initialState)
})

afterEach(() => {
  authMachine = null
  authService = null

  server.resetHandlers()
})

afterAll(() => server.close())

test(`should reach an error state if email address or password is invalid`, async () => {
  // Scenario 1: Providing an invalid email address with a valid password
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.userName(),
    password: faker.internet.password(15)
  })

  const emailErrorSignInState: AuthState = await waitFor(
    authService,
    (state: AuthState) => !!state.value
  )

  expect(
    emailErrorSignInState.matches({
      authentication: { signedOut: { failed: { validation: 'email' } } }
    })
  ).toBeTruthy()

  // Scenario 2: Providing a valid email address with an invalid password
  authService.send({
    type: 'SIGNIN_PASSWORD',
    email: faker.internet.email('john', 'doe'),
    password: faker.internet.password(2)
  })

  const passwordErrorSignInState: AuthState = await waitFor(
    authService,
    (state: AuthState) => !!state.value
  )

  expect(
    passwordErrorSignInState.matches({
      authentication: { signedOut: { failed: { validation: 'password' } } }
    })
  ).toBeTruthy()
})

test(`should reach an error state if incorrect credentials were provided`, async () => {
  server.use(incorrectEmailPasswordHandler)

  const email = faker.internet.email('john', 'doe')
  const password = faker.internet.password(15)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email,
    password
  })

  const signInState: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedOut: { failed: 'server' } } })
  )

  expect(signInState.context.errors).toMatchObject({
    authentication: expect.objectContaining({ message: 'Incorrect email or password' })
  })
})

test(`should be able to sign in if correct credentials were provided`, async () => {
  const email = faker.internet.email('john', 'doe')
  const password = faker.internet.password(15)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email,
    password
  })

  const signInState: AuthState = await waitFor(authService, (state: AuthState) =>
    state.matches({ authentication: { signedIn: { refreshTimer: { running: 'pending' } } } })
  )

  expect(signInState.context.user).not.toBeNull()
})
