import { HttpResponse, rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when trying to sign out.
 */
export const signOutNetworkErrorHandler = rest.post(
  `${BASE_URL}/signout`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign out.
 */
export const signOutInternalErrorHandler = rest.post(`${BASE_URL}/signout`, ({ request }) =>
  HttpResponse.json(
    {
      status: 500,
      error: 'internal-error',
      message: 'Internal error'
    },
    { status: 500 }
  )
)

/**
 * Request handler for MSW to mock successful sign out requests or bad requests.
 */
export const signOutHandler = rest.post(`${BASE_URL}/signout`, async ({ request }) => {
  const reqBody = (await request.json()) as { refreshToken?: string }
  if (!reqBody?.refreshToken) {
    return new Response(
      JSON.stringify({
        status: 400,
        message: '"refreshToken" is required',
        error: 'invalid-request'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'application/json' } })
})

/**
 * Request handler for MSW to mock an unauthorized error when trying to sign out with an invalid
 * refresh token.
 */
export const signOutAllErrorHandler = rest.post(`${BASE_URL}/signout`, () =>
  HttpResponse.json(
    {
      status: 401,
      message: 'User must be signed in to sign out from all sessions',
      error: 'unauthenticated-user'
    },
    { status: 401 }
  )
)
