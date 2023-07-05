import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful sign in request using PAT method.
 */
export const patSignInNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/pat`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock a successful sign in request using PAT method.
 */
export const patSignInInternalErrorHandler = rest.post(`${BASE_URL}/signin/pat`, () =>
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
 * Request handler for MSW to mock an unauthorized sign in request using PAT method.
 */
export const patSignInUnauthorizedErrorHandler = rest.post(`${BASE_URL}/signin/pat`, () =>
  HttpResponse.json(
    {
      status: 401,
      error: 'invalid-or-expired-pat',
      message: 'Invalid or expired PAT'
    },
    { status: 401 }
  )
)

/**
 * Request handler for MSW to mock a successful sign in request using PAT method.
 */
export const patSignInSuccessHandler = rest.post(`${BASE_URL}/signin/pat`, () =>
  HttpResponse.json<{ mfa: Mfa | null; session: NhostSession | null }>(
    {
      session: {
        user: fakeUser,
        accessTokenExpiresIn: 900,
        accessToken: faker.datatype.string(40),
        refreshToken: null
      },
      mfa: null
    },
    { status: 200 }
  )
)
