import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { incorrectEmailPasswordHandler, successHandlers } from './__mocks__/signInHandlers'
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

const server = setupServer(...successHandlers)

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
  server.resetHandlers()
  authService.stop()
})

afterAll(() => server.close())

test(`should react an error state if email address is invalid`, async () => {
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

test(`should react an error state if password is invalid`, async () => {
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

test(`should reach an error state if network connection is not available`, async () => {
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
      // todo: we should get the last state here
      if (state.matches({ authentication: { signedOut: { failed: 'server' } } })) {
        resolve(state)
      }
    })
  })

  expect(signInState.context.errors).toMatchObject({
    authentication: expect.objectContaining({ message: 'Incorrect email or password' })
  })
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
      // todo: we should get the last state here
      if (state.matches({ authentication: { signedIn: { refreshTimer: 'idle' } } })) {
        resolve(state)
      }
    })
  })

  expect(signInState.context.user).toMatchObject({ displayName: 'John Doe' })
})
