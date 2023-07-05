import { HttpResponse, rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when changing password address.
 */
export const changePasswordNetworkErrorHandler = rest.post(
  `${BASE_URL}/user/password`,
  () => new Response(null, { status: 500, statusText: 'Network erro' })
)

/**
 * Request handler for MSW to mock an an internal server error when changing password address.
 */
export const changePasswordInternalErrorHandler = rest.post(`${BASE_URL}/user/password`, () =>
  HttpResponse.json(
    { status: 500, error: 'internal-error', message: 'Internal error' },
    { status: 500 }
  )
)

/**
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * changing password address.
 */
export const changePasswordUnauthorizedErrorHandler = rest.post(`${BASE_URL}/user/password`, () =>
  HttpResponse.json(
    {
      status: 401,
      message: 'User is not logged in',
      error: 'unauthenticated-user'
    },
    { status: 401 }
  )
)

/**
 * Request handler for MSW to mock a successful network request when changing password address.
 */
export const changePasswordSuccessHandler = rest.post(
  `${BASE_URL}/user/password`,
  () => new Response('OK', { status: 200 })
)
