import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a network error when trying to sign up.
 */
export const signUpNetworkErrorHandler = rest.post(
  `${BASE_URL}/signup/email-password`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign up.
 */
export const signUpInternalErrorHandler = rest.post(`${BASE_URL}/signup/email-password`, () =>
  HttpResponse.json(
    {
      status: 500,
      error: 'internal-error',
      message: 'Internal error'
    },
    { status: 500 }
  )
)

/**
 * Request handler for MSW to mock a conflicting email error when trying to sign up.
 */
export const signUpConflictErrorHandler = rest.post(`${BASE_URL}/signup/email-password`, () =>
  HttpResponse.json(
    {
      status: 409,
      message: 'Email already in use',
      error: 'email-already-in-use'
    },
    { status: 409 }
  )
)

/**
 * Request handler for MSW to mock a successful sign up request when session is not returned by
 * the server.
 */
export const signUpSuccessHandler = rest.post(`${BASE_URL}/signup/email-password`, () =>
  HttpResponse.json<{ mfa: Mfa | null; session: NhostSession | null }>({
    session: null,
    mfa: null
  })
)

/**
 * Request handler for MSW to mock a successful sign up request when session is returned by
 * the server.
 */
export const signUpWithSessionHandler = rest.post(`${BASE_URL}/signup/email-password`, () =>
  HttpResponse.json<{ mfa: Mfa | null; session: NhostSession | null }>({
    session: {
      user: fakeUser,
      accessTokenExpiresIn: 900,
      accessToken: faker.datatype.string(40),
      refreshToken: faker.datatype.uuid()
    },
    mfa: null
  })
)
