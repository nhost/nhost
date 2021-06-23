import { NextFunction, Response, Request } from 'express'
import logger from './logger'

interface Error {
  output?: {
    payload?: Record<string, unknown>
    statusCode?: number
  }
  details?: [
    {
      message?: string
    }
  ]
}

/**
 * This is a custom error middleware for Express.
 * https://expressjs.com/en/guide/error-handling.html
 */
export async function errors(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Promise<unknown> {
  const code = err?.output?.statusCode || 400

  // log error
  logger.error(err)

  /**
   * The default error message looks like this.
   */
  const error = err?.output?.payload || {
    statusCode: code,
    error: code === 400 ? 'Bad Request' : 'Internal Server Error',
    message: err?.details?.[0]?.message
  }

  return res.status(code).send({ ...error })
}
