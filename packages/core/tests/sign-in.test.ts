import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { authTokenSuccessHandler } from './__mocks__/generalHandlers'
import {
  correctEmailPasswordHandler,
  incorrectEmailPasswordHandler
} from './__mocks__/signInHandlers'
import { AuthContext, AuthEvents, createAuthMachine } from '../src/machines'
import { BaseActionObject, interpret, ResolveTypegenMeta, ServiceMap, State } from 'xstate'
import { Typegen0 } from '../src/machines/index.typegen'
import faker from '@faker-js/faker'

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

const server = setupServer(authTokenSuccessHandler, correctEmailPasswordHandler)

const authMachine = createAuthMachine({
  backendUrl: 'http://localhost:1337/v1/auth',
  clientUrl: 'http://localhost:3000'
})

const authService = interpret(authMachine)

beforeAll(() => server.listen())

beforeEach(() => {
  authService.start()
})

afterEach(() => {
  authService.stop()
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

  const emailErrorSignInState = await new Promise<AuthState>((resolve) => {
    authService.onTransition((state) => {
      if (state.value) {
        resolve(state)
      }
    })
  })

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

  const passwordErrorSignInState = await new Promise<AuthState>((resolve) => {
    authService.onTransition((state) => {
      if (state.value) {
        resolve(state)
      }
    })
  })

  expect(
    passwordErrorSignInState.matches({
      authentication: { signedOut: { failed: { validation: 'password' } } }
    })
  ).toBeTruthy()
})

test(`should sign in the user if correct credentials were provided`, async () => {
  const email = faker.internet.email('john', 'doe')
  const password = faker.internet.password(15)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email,
    password
  })

  const signInState = await new Promise<AuthState>((resolve) => {
    authService.onTransition((state) => {
      if (state.matches({ authentication: { signedIn: { refreshTimer: 'idle' } } })) {
        resolve(state)
      }
    })
  })

  expect(signInState.context.user).not.toBeNull()
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

  const signInState = await new Promise<AuthState>((resolve) => {
    authService.onTransition((state) => {
      if (state.matches({ authentication: { signedOut: { failed: 'server' } } })) {
        resolve(state)
      }
    })
  })

  expect(signInState.context.errors).toMatchObject({
    authentication: expect.objectContaining({ message: 'Incorrect email or password' })
  })
})
