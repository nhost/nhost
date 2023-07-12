import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { AuthErrorPayload } from '../../../src'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a successful PAT creation request.
 */
export const createPATSuccessHandler = rest.post(`${BASE_URL}/pat`, () =>
  HttpResponse.json<{
    error: AuthErrorPayload | null
    id: string | null
    personalAccessToken: string | null
  }>(
    {
      error: null,
      id: faker.datatype.uuid(),
      personalAccessToken: faker.datatype.uuid()
    },
    { status: 200 }
  )
)

/**
 * Request handler for MSW to mock a failed PAT creation request.
 */
export const createPATExpirationErrorHandler = rest.post(`${BASE_URL}/pat`, () =>
  HttpResponse.json<{
    error: AuthErrorPayload | null
    id: string | null
    personalAccessToken: string | null
  }>(
    {
      error: {
        error: 'invalid-expiration',
        message: 'Invalid expiration',
        status: 400
      },
      id: null,
      personalAccessToken: null
    },
    { status: 400 }
  )
)
