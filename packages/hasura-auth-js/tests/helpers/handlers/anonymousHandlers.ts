import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import { fakeAnonymousUser } from '../mocks/user'

/**
 * Request handler for MSW to mock a network error when trying to sign anonymously.
 */
export const anonymousNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/anonymous`,
  () => new Response(null, { status: 500, statusText: 'Network error' })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign anonymously.
 */
export const anonymousInternalErrorHandler = rest.post(`${BASE_URL}/signin/anonymous`, () =>
  HttpResponse.json(
    { status: 500, error: 'internal-error', message: 'Internal error' },
    { status: 500 }
  )
)

/**
 * Request handler for MSW to mock a successful anonymous sign.
 */
export const correctAnonymousHandler = rest.post(`${BASE_URL}/signin/anonymous`, () =>
  HttpResponse.json<{ mfa: Mfa | null; session: NhostSession | null }>({
    session: {
      user: fakeAnonymousUser,
      accessTokenExpiresIn: 900,
      accessToken: faker.datatype.string(40),
      refreshToken: faker.datatype.uuid()
    },
    mfa: null
  })
)

/**
 * Request handler for MSW to mock a successful deanonymisation request for an anonymous user
 */
export const deamonymisationSuccessfulHandler = rest.post(
  `${BASE_URL}/user/deanonymize`,
  () => new Response('OK', { status: 200 })
)

/**
 * Request handler for MSW to mock a deanonymisation error for an invalid deanonymisation method
 */
export const invalidDeamonymisationEmailError = rest.post(`${BASE_URL}/user/deanonymize`, () =>
  HttpResponse.json(
    {
      status: 400,
      message: '"email" must be a valid email',
      error: 'invalid-request'
    },
    { status: 400 }
  )
)
