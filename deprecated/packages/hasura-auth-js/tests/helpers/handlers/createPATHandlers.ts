import { faker } from '@faker-js/faker'
import { rest } from 'msw'
import { AuthErrorPayload } from '../../../src'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a successful PAT creation request.
 */
export const createPATSuccessHandler = rest.post(`${BASE_URL}/pat`, (_req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json<{
      error: AuthErrorPayload | null
      id: string | null
      personalAccessToken: string | null
    }>({
      error: null,
      id: faker.datatype.uuid(),
      personalAccessToken: faker.datatype.uuid()
    })
  )
})

/**
 * Request handler for MSW to mock a failed PAT creation request.
 */
export const createPATExpirationErrorHandler = rest.post(`${BASE_URL}/pat`, (_req, res, ctx) => {
  return res(
    ctx.status(400),
    ctx.json<{
      error: AuthErrorPayload | null
      id: string | null
      personalAccessToken: string | null
    }>({
      error: {
        error: 'invalid-expiration',
        message: 'Invalid expiration',
        status: 400
      },
      id: null,
      personalAccessToken: null
    })
  )
})
