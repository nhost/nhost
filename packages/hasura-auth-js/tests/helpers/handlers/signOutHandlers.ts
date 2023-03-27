import { rest, RestRequest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when trying to sign out.
 */
export const signOutNetworkErrorHandler = rest.post(`${BASE_URL}/signout`, (_req, res) => {
  return res.networkError('Network error')
})

/**
 * Request handler for MSW to mock an internal server error when trying to sign out.
 */
export const signOutInternalErrorHandler = rest.post(`${BASE_URL}/signout`, (_req, res, ctx) => {
  return res(
    ctx.status(500),
    ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
  )
})

/**
 * Request handler for MSW to mock successful sign out requests or bad requests.
 */
export const signOutHandler = rest.post(
  `${BASE_URL}/signout`,
  (req: RestRequest<{ refreshToken?: string }>, res, ctx) => {
    if (!req.body.refreshToken) {
      return res(
        ctx.status(400),
        ctx.json({
          status: 400,
          message: '"refreshToken" is required',
          error: 'invalid-request'
        })
      )
    }

    return res(ctx.status(200), ctx.json('OK'))
  }
)

/**
 * Request handler for MSW to mock an unauthorized error when trying to sign out with an invalid
 * refresh token.
 */
export const signOutAllErrorHandler = rest.post(`${BASE_URL}/signout`, (_req, res, ctx) => {
  return res(
    ctx.status(401),
    ctx.json({
      status: 401,
      message: 'User must be signed in to sign out from all sessions',
      error: 'unauthenticated-user'
    })
  )
})
