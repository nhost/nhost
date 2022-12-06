import { faker } from '@faker-js/faker'
import { rest } from 'msw'
import { NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

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

/**
 * Request handler for MSW to mock an unauthorized error when trying to get a new access token.
 */
export const authTokenUnauthorizedHandler = rest.post(`${BASE_URL}/token`, (_req, res, ctx) => {
  return res(
    ctx.status(401),
    ctx.json({
      status: 401,
      message: 'Invalid or expired refresh token',
      error: 'invalid-refresh-token'
    })
  )
})

/**
 * Request handler for MSW to mock an internal server error when trying to get a new access token.
 */
export const authTokenInternalErrorHandler = rest.post(`${BASE_URL}/token`, (_req, res, ctx) => {
  return res(
    ctx.status(500),
    ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
  )
})

/**
 * Request handler for MSW to mock a network error when requesting a new access token.
 */
export const authTokenNetworkErrorHandler = rest.post(`${BASE_URL}/token`, (_req, res) => {
  return res.networkError('Network error')
})
