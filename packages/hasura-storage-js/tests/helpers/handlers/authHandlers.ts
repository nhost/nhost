import faker from '@faker-js/faker'
import { NhostSession } from '@nhost/core'

import { rest } from 'msw'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful request for a new access token.
 */
export const authTokenSuccessHandler = rest.post(`${BASE_URL}/v1/auth/token`, (_req, res, ctx) =>
  res(
    ctx.json<NhostSession>({
      accessToken: faker.datatype.string(40),
      refreshToken: faker.datatype.uuid(),
      accessTokenExpiresIn: 900,
      user: fakeUser
    })
  )
)
