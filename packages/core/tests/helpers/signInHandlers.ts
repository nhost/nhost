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
 * Request handler for MSW to mock an unsuccessful sign in request. Useful if you'd like to mock a
 * scenario where the user provided an incorrect email or password.
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
