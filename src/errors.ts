import { NextFunction, Response, Request } from 'express';
import { logger } from './logger';

/**
 * This is a custom error middleware for Express.
 * https://expressjs.com/en/guide/error-handling.html
 */
export async function errors(
  error: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Promise<unknown> {
  logger.error(error.message);

  if (process.env.NODE_ENV === 'production') {
    return res.status(500).send();
  } else {
    return res.status(500).send({
      message: error.message,
    });
  }
}

// TODO shared with the SDK
export type ErrorPayload = {
  error: string;
  status: number;
  message: string;
};

export const REQUEST_VALIDATION_ERROR: ErrorPayload = {
  status: 400,
  error: 'request-validation-error',
  message: 'The request payload is incorrect',
};
