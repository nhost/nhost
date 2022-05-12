import { rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when trying to sign up.
 */
export const signUpNetworkErrorHandler = rest.post(
  `${BASE_URL}/signup/email-password`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)
