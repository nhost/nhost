import faker from '@faker-js/faker'
import { rest } from 'msw'
import { NhostSession } from '../../src/types'
import { BASE_URL } from './config'
import fakeUser from './fake/user'

/**
 * Request handler for MSW to mock a successful request for a new access token.
 */
export const authTokenSuccessHandler = rest.post(`${BASE_URL}/token`, (req, res, ctx) => {
  return res(
    ctx.json<NhostSession>({
      accessToken: faker.datatype.string(40),
      accessTokenExpiresIn: 900,
      refreshToken: faker.datatype.string(40),
      user: fakeUser
    })
  )
})
