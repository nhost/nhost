import { faker } from '@faker-js/faker'
import { rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import { fakeAnonymousUser } from '../mocks/user'

/**
 * Request handler for MSW to mock a network error when trying to sign anonymously.
 */
export const anonymousNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/anonymous`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign anonymously.
 */
export const anonymousInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/anonymous`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock a successful anonymous sign.
 */
export const correctAnonymousHandler = rest.post(
  `${BASE_URL}/signin/anonymous`,
  (_req, res, ctx) => {
    return res(
      ctx.json<{ mfa: Mfa | null; session: NhostSession | null }>({
        session: {
          user: fakeAnonymousUser,
          accessTokenExpiresIn: 900,
          accessToken: faker.datatype.string(40),
          refreshToken: faker.datatype.uuid()
        },
        mfa: null
      })
    )
  }
)

/**
 * Request handler for MSW to mock a successful deanonymisation request for an anonymous user
 */
export const deamonymisationSuccessfulHandler = rest.post(
  `${BASE_URL}/user/deanonymize`,
  (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json('OK'))
  }
)

/**
 * Request handler for MSW to mock a deanonymisation error for an invalid deanonymisation method
 */
export const invalidDeamonymisationEmailError = rest.post(
  `${BASE_URL}/user/deanonymize`,
  (_req, res, ctx) =>
    res(
      ctx.status(400),
      ctx.json({
        status: 400,
        message: '"email" must be a valid email',
        error: 'invalid-request'
      })
    )
)
