import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful request for a new access token.
 */
export const authTokenSuccessHandler = rest.post(`${BASE_URL}/token`, () => {
  return HttpResponse.json({
    accessToken: faker.datatype.string(40),
    refreshToken: faker.datatype.uuid(),
    accessTokenExpiresIn: 900,
    user: fakeUser
  })
})

/**
 * Request handler for MSW to mock an unauthorized error when trying to get a new access token.
 */
export const authTokenUnauthorizedHandler = rest.post(`${BASE_URL}/token`, () => {
  return HttpResponse.json(
    {
      status: 401,
      message: 'Invalid or expired refresh token',
      error: 'invalid-refresh-token'
    },
    { status: 401 }
  )
})

/**
 * Request handler for MSW to mock an internal server error when trying to get a new access token.
 */
export const authTokenInternalErrorHandler = rest.post(`${BASE_URL}/token`, () =>
  HttpResponse.json(
    { status: 500, error: 'internal-error', message: 'Internal error' },
    { status: 500 }
  )
)

/**
 * Request handler for MSW to mock a network error when requesting a new access token.
 */
export const authTokenNetworkErrorHandler = rest.post(`${BASE_URL}/token`, () => {
  return new Response('Network error', { status: 500 })
})
