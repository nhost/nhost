import { HttpResponse, rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when changing email address.
 */
export const changeEmailNetworkErrorHandler = rest.post(
  `${BASE_URL}/user/email/change`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an an internal server error when changing email address.
 */
export const changeEmailInternalErrorHandler = rest.post(`${BASE_URL}/user/email/change`, () =>
  HttpResponse.json(
    { status: 500, error: 'internal-error', message: 'Internal error' },
    { status: 500 }
  )
)

/**
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * changing email address.
 */
export const changeEmailUnauthorizedErrorHandler = rest.post(`${BASE_URL}/user/email/change`, () =>
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
 * Request handler for MSW to mock a successful network request when changing email address.
 */
export const changeEmailSuccessHandler = rest.post(
  `${BASE_URL}/user/email/change`,
  () => new Response('OK', { status: 200 })
)
