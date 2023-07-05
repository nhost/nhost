import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful sign in request when using the email and password
 * sign in method.
 */
export const correctEmailPasswordHandler = rest.post(`${BASE_URL}/signin/email-password`, () =>
  HttpResponse.json<{
    mfa: Mfa | null
    session: NhostSession | null
  }>({
    session: {
      user: fakeUser,
      accessTokenExpiresIn: 900,
      accessToken: faker.datatype.string(40),
      refreshToken: faker.datatype.uuid()
    },
    mfa: null
  })
)

/**
 * Request handler fro MSW to mock a successful sign in request when using the email and password
 * sign in method and when the user has MFA set up for their account.
 */
export const correctEmailPasswordWithMfaHandler = rest.post(
  `${BASE_URL}/signin/email-password`,
  () =>
    HttpResponse.json<{
      mfa: Mfa
      session: NhostSession | null
    }>({
      session: null,
      mfa: {
        ticket: `mfaTotp:${faker.datatype.uuid()}`
      }
    })
)

/**
 * Request handler for MSW to mock an unsuccessful sign in request using the email and
 * password sign in method. Useful if you'd like to mock a scenario where the user provided an
 * incorrect email or password.
 */
export const incorrectEmailPasswordHandler = rest.post(`${BASE_URL}/signin/email-password`, () =>
  HttpResponse.json(
    {
      status: 401,
      error: 'invalid-email-password',
      message: 'Incorrect email or password'
    },
    { status: 401 }
  )
)

/**
 * Request handler for MSW to mock an unsuccessful sign in request using the email and
 * password sign in method. Useful if you'd like to mock a scenario where the user provided an
 * signed in with an unverified account.
 */
export const unverifiedEmailErrorHandler = rest.post(`${BASE_URL}/signin/email-password`, () =>
  HttpResponse.json(
    {
      status: 401,
      error: 'unverified-email',
      message: 'Email needs verification'
    },
    { status: 401 }
  )
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the email and
 * password sign in method.
 */
export const emailPasswordNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/email-password`,
  () => new Response(null, { status: 500, statusText: 'Network erro' })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the email
 * and password sign in method.
 */
export const emailPasswordInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/email-password`,
  () =>
    HttpResponse.json(
      {
        status: 500,
        error: 'internal-error',
        message: 'Internal error'
      },
      { status: 500 }
    )
)
