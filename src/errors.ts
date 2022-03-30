import { NextFunction, Response, Request } from 'express';
import { logger } from './logger';

/**
 * This is a custom error middleware for Express.
 * https://expressjs.com/en/guide/error-handling.html
 */
export async function serverErrors(
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

const asErrors = <T>(et: {
  [K in keyof T]: Pick<ErrorPayload, 'status' | 'message'>;
}) => et;

const ERRORS = asErrors({
  'route-not-found': {
    status: 404,
    message: 'Route not found',
  },
  'disabled-endpoint': {
    status: 404,
    message: 'This endpoint is disabled',
  },
  'request-validation-error': {
    status: 400,
    message: 'The request payload is incorrect',
  },
  'disabled-mfa-totp': {
    status: 400,
    message: 'MFA TOTP is not enabled for this user',
  },
  'no-totp-secret': {
    status: 400,
    message: 'OTP secret is not set for user',
  },
  'disabled-user': {
    status: 401,
    message: 'User is disabled',
  },
  'invalid-email-password': {
    status: 401,
    message: 'Incorrect email or password',
  },
  'invalid-otp': {
    status: 401,
    message: 'Invalid or expired OTP',
  },
  'unverified-user': {
    status: 401,
    message: 'Email is not verified',
  },
  'email-already-in-use': {
    status: 409,
    message: 'Email already in use',
  },
  'mfa-type-not-found': {
    status: 400,
    message: 'There is no active MFA set for the user',
  },
  'email-already-verified': {
    status: 400,
    message: "User's email is already verified",
  },
  'totp-already-active': {
    status: 400,
    message: 'TOTP MFA already active',
  },
  'user-not-found': {
    status: 400,
    message: 'No user found',
  },
  'user-not-anonymous': {
    status: 400,
    message: 'Logged in user is not anonymous',
  },
  'invalid-refresh-token': {
    status: 401,
    message: 'Invalid or expired refresh token',
  },
  // TODO must be eventually part of joi request validation
  'missing-redirection': {
    status: 400,
    message: 'Missing redirectTo',
  },
  'invalid-admin-secret': {
    status: 401,
    message: 'Invalid admin secret',
  },
  'unauthenticated-user': {
    status: 401,
    message: 'User is not logged in',
  },
  'forbidden-endpoint-in-production': {
    status: 400,
    message: 'This endpoint is only available on test environments',
  },
  'invalid-sign-in-method': {
    status: 400,
    message: 'Incorrect sign in method',
  },
});

export const sendError = (
  res: Response,
  code: keyof typeof ERRORS,
  customMessage?: string
) => {
  const error = ERRORS[code];
  const message = customMessage ?? error.message;
  const status = error.status;
  return res.status(status).send({ status, message, error: code });
};
