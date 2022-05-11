import faker from '@faker-js/faker'
import { rest } from 'msw'
import { NhostSession } from '../../src/types'
import { BASE_URL } from './config'
import fakeUser from './__mocks__/user'

/**
 * Request handler for MSW to mock a successful sign in request.
 */
export const correctEmailPasswordHandler = rest.post(
  `${BASE_URL}/signin/email-password`,
  (_req, res, ctx) => {
    return res(
      ctx.json<{ session: NhostSession }>({
        session: {
          user: fakeUser,
          accessTokenExpiresIn: 900,
          accessToken: faker.datatype.string(40),
          refreshToken: faker.datatype.uuid()
        }
      })
    )
  }
)

/**
 * Request handler for MSW to mock an unsuccessful sign in request using the email and
 * password method. Useful if you'd like to mock a scenario where the user provided an incorrect
 * email or password.
 */
export const incorrectEmailPasswordHandler = rest.post(
  `${BASE_URL}/signin/email-password`,
  (_req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({
        status: 401,
        error: 'invalid-email-password',
        message: 'Incorrect email or password'
      })
    )
  }
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the email and
 * password method.
 */
export const emailPasswordNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/email-password`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock a successful sign in request using the passwordless email sign in
 * method.
 */
export const correctPasswordlessEmailHandler = rest.post(
  `${BASE_URL}/signin/passwordless/email`,
  (_req, res, ctx) => {
    return res(ctx.status(200))
  }
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the passwordless
 * email sign in method.
 */
export const passwordlessEmailPasswordNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/email`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)
