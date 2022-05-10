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

test(`should reach an error state if email address is invalid`, async () => {
  const email = faker.internet.userName()
  const password = faker.internet.password(15)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email,
    password
  })

  const signInState = await new Promise<AuthState>((resolve) => {
    authService.onTransition((state) => {
      if (state.value) {
        resolve(state)
      }
    })
  })

  expect(
    signInState.matches({ authentication: { signedOut: { failed: { validation: 'email' } } } })
  ).toBeTruthy()
})

test(`should reach an error state if password is invalid`, async () => {
  const email = faker.internet.email('john', 'doe')
  const password = faker.internet.password(2)

  authService.send({
    type: 'SIGNIN_PASSWORD',
    email,
    password
  })

  const signInState = await new Promise<AuthState>((resolve) => {
    authService.onTransition((state) => {
      if (state.value) {
        resolve(state)
      }
    })
  })

  expect(
    signInState.matches({ authentication: { signedOut: { failed: { validation: 'password' } } } })
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
