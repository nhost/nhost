import { rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock an internal server error when uploading a file.
 */
export const uploadFileInternalErrorHandler = rest.post(
  `${BASE_URL}/v1/storage/files`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock a network error when uploading a file
 */
export const uploadFiledNetworkErrorHandler = rest.post(
  `${BASE_URL}/v1/storage/files`,
  (_req, res) => res.networkError('Network error')
)
