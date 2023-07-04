import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when generating MFA TOTP.
 */
export const generateMfaTotpNetworkErrorHandler = rest.get(
  `${BASE_URL}/mfa/totp/generate`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an an internal server error when generating MFA TOTP.
 */
export const generateMfaTotpInternalErrorHandler = rest.get(`${BASE_URL}/mfa/totp/generate`, () =>
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
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * generating MFA TOTP.
 */
export const generateMfaTotpUnauthorizedErrorHandler = rest.get(
  `${BASE_URL}/mfa/totp/generate`,
  () =>
    HttpResponse.json(
      {
        status: 401,
        message: 'User is not logged in',
        error: 'unauthenticated-user'
      },
      { status: 401 }
    )
)

/**
 * Request handler for MSW to mock a successful network request when generating MFA TOTP.
 */
export const generateMfaTotpSuccessHandler = rest.get(`${BASE_URL}/mfa/totp/generate`, () =>
  HttpResponse.json(
    {
      imageUrl: faker.image.imageUrl(),
      totpSecret: faker.datatype.uuid()
    },
    { status: 200 }
  )
)

/**
 * Request handler for MSW to mock a network error when activating MFA.
 */
export const activateMfaTotpNetworkErrorHandler = rest.post(
  `${BASE_URL}/user/mfa`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an an internal server error when activating MFA.
 */
export const activateMfaTotpInternalErrorHandler = rest.post(`${BASE_URL}/user/mfa`, () =>
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
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * activating MFA.
 */
export const activateMfaTotpUnauthorizedErrorHandler = rest.post(`${BASE_URL}/user/mfa`, () =>
  HttpResponse.json(
    {
      status: 401,
      message: 'User is not logged in',
      error: 'unauthenticated-user'
    },
    { status: 401 }
  )
)

/**
 * Request handler for MSW to mock an successful network request when activating MFA.
 */
export const activateMfaTotpSuccessHandler = rest.post(
  `${BASE_URL}/user/mfa`,
  () => new Response('OK', { status: 200 })
)
