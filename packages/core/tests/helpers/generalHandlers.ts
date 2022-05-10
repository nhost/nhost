import faker from '@faker-js/faker'
import { rest } from 'msw'
import { NhostSession } from '../../src/types'
import fakeUser from './__mocks__/user'
import { BASE_URL } from './config'

/**
 * Request handler for MSW to mock a successful request for a new access token.
 */
export const authTokenSuccessHandler = rest.post(`${BASE_URL}/token`, (_req, res, ctx) => {
  return res(
    ctx.json<NhostSession>({
      accessToken: faker.datatype.string(40),
      refreshToken: faker.datatype.uuid(),
      accessTokenExpiresIn: 900,
      user: fakeUser
    })
  )
})
