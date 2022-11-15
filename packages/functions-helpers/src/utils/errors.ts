import { NextFunction, Request, RequestHandler, Response } from 'express'

interface ParsedQs {
  [key: string]: undefined | string | string[] | ParsedQs | ParsedQs[]
}

export class ExpressError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)

    this.status = status

    // 👇️ because we are extending a built-in class
    // Object.setPrototypeOf(this, ExpressError.prototype)
  }
}

export type ErrorRequestHandler<
  P = Record<string, string>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  err: ExpressError,
  req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => void

const defaultErrorHandler: ErrorRequestHandler = (err, _, res) =>
  res.status(err.status).json({ status: err.status, message: err.message })

export const wrapErrors = (
  handlers: RequestHandler[],
  errorHandler: ErrorRequestHandler = defaultErrorHandler
): RequestHandler[] =>
  handlers.map((handler) => (req, res, next) => {
    try {
      handler(req, res, next)
    } catch (error) {
      errorHandler(error as ExpressError, req, res, next)
    }
  })
