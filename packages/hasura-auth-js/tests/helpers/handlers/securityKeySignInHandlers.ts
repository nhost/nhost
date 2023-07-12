import { faker } from '@faker-js/faker'
import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types'
import { HttpResponse, rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful sign in request when using the email and password
 * sign in method.
 */
export const correctEmailSecurityKeyHandler = rest.post(`${BASE_URL}/signin/webauthn`, () =>
  HttpResponse.json<PublicKeyCredentialRequestOptionsJSON>({
    challenge: faker.datatype.string(30)
  })
)

/**
 * Request handler for MSW to mock a successful sign in verification when using the email and password
 * sign in method.
 */
export const correctSecurityKeyVerifyHandler = rest.post(`${BASE_URL}/signin/webauthn/verify`, () =>
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
 * Request handler for MSW to mock an incorrect sign in verification when using the email and password
 * sign in method.
 */
export const incorrectSecurityKeyVerifyHandler = rest.post(
  `${BASE_URL}/signin/webauthn/verify`,
  () =>
    HttpResponse.json(
      {
        status: 401,
        error: 'invalid-webauthn-authenticator',
        message: 'Invalid WebAuthn authenticator'
      },
      { status: 401 }
    )
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the email + security key
 *  sign in method.
 */
export const emailSecurityKeyNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/webauthn`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the email + security key
 *  sign in method.
 */
export const emailSecurityKeyInternalErrorHandler = rest.post(`${BASE_URL}/signin/webauthn`, () =>
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
 * Request handler for MSW to mock an unsuccessful sign (user not found) in request using the security key + email
 * sign in method.
 */
export const userNotFoundSecurityKeyHandler = rest.post(`${BASE_URL}/signin/webauthn`, () =>
  HttpResponse.json(
    {
      status: 400,
      error: 'user-not-found',
      message: 'No user found'
    },
    { status: 400 }
  )
)

/**
 * Request handler for MSW to mock an unsuccessful sign in request using the security key + email
 *  sign in method. Useful if you'd like to mock a scenario where the user provided an
 * signed in with an unverified account.
 */
export const unverifiedEmailSecurityKeyErrorHandler = rest.post(`${BASE_URL}/signin/webauthn`, () =>
  HttpResponse.json(
    {
      status: 401,
      error: 'unverified-email',
      message: 'Email needs verification'
    },
    { status: 401 }
  )
)
