import faker from '@faker-js/faker'
import { rest } from 'msw'
import { Mfa, NhostSession } from '../../../src/types'
import { BASE_URL } from '../config'
import fakeUser, { fakeAnonymousUser } from '../mocks/user'

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
    return res(
      ctx.json<{ mfa: Mfa | null; session: NhostSession | null }>({
        session: {
          user: fakeUser,
          accessTokenExpiresIn: 900,
          accessToken: faker.datatype.string(40),
          refreshToken: faker.datatype.uuid()
        },
        mfa: null
      })
    )
  }
)
