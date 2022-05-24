import { NextFunction, Response, Request } from 'express';
import { StatusCodes } from 'http-status-codes';

import { logger } from './logger';
import { generateRedirectUrl } from './utils';

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
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send();
  } else {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
      message: error.message,
    });
  }
}

// TODO Errors must be put in a shared package that the SDK also uses
export type ErrorPayload = {
  error: string;
  status: StatusCodes;
  message: string;
};

export const REQUEST_VALIDATION_ERROR: ErrorPayload = {
  status: StatusCodes.BAD_REQUEST,
  error: 'invalid-request',
  message: 'The request payload is incorrect',
};

const asErrors = <T>(et: {
  [K in keyof T]: Pick<ErrorPayload, 'status' | 'message'>;
}) => et;

export const ERRORS = asErrors({
  'route-not-found': {
    status: StatusCodes.NOT_FOUND,
    message: 'Route not found',
  },
  'disabled-endpoint': {
    status: StatusCodes.NOT_FOUND,
    message: 'This endpoint is disabled',
  },
  'invalid-request': {
    status: StatusCodes.BAD_REQUEST,
    message: 'The request payload is incorrect',
  },
  'disabled-mfa-totp': {
    status: StatusCodes.BAD_REQUEST,
    message: 'MFA TOTP is not enabled for this user',
  },
  'no-totp-secret': {
    status: StatusCodes.BAD_REQUEST,
    message: 'OTP secret is not set for user',
  },
  'disabled-user': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'User is disabled',
  },
  'invalid-email-password': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Incorrect email or password',
  },
  'invalid-otp': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired OTP',
  },
  'invalid-ticket': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired verification ticket',
  },
  'unverified-user': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Email is not verified',
  },
  'email-already-in-use': {
    status: StatusCodes.CONFLICT,
    message: 'Email already in use',
  },
  'mfa-type-not-found': {
    status: StatusCodes.BAD_REQUEST,
    message: 'There is no active MFA set for the user',
  },
  'email-already-verified': {
    status: StatusCodes.BAD_REQUEST,
    message: "User's email is already verified",
  },
  'totp-already-active': {
    status: StatusCodes.BAD_REQUEST,
    message: 'TOTP MFA already active',
  },
  'user-not-found': {
    status: StatusCodes.BAD_REQUEST,
    message: 'No user found',
  },
  'user-not-anonymous': {
    status: StatusCodes.BAD_REQUEST,
    message: 'Logged in user is not anonymous',
  },
  'invalid-refresh-token': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired refresh token',
  },
  'invalid-redirection': {
    status: StatusCodes.BAD_REQUEST,
    message: 'Invalid or missing redirectTo',
  },
  'invalid-admin-secret': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid admin secret',
  },
  'unauthenticated-user': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'User is not logged in',
  },
  'forbidden-endpoint-in-production': {
    status: StatusCodes.BAD_REQUEST,
    message: 'This endpoint is only available on test environments',
  },
  'invalid-sign-in-method': {
    status: StatusCodes.BAD_REQUEST,
    message: 'Incorrect sign in method',
  },
  'cannot-send-sms': {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Error sending SMS',
  },
  'invalid-sms-provider-type': {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Absent or invalid SMS provider type',
  },
});

export const sendError = (
  res: Response,
  code: keyof typeof ERRORS,
  {
    customMessage,
    redirectTo,
  }: { customMessage?: string; redirectTo?: string } = {}
) => {
  const error = ERRORS[code];
  const message = customMessage ?? error.message;
  const status = error.status;

  if (redirectTo) {
    const redirectUrl = generateRedirectUrl(redirectTo, {
      error: code,
      errorDescription: message,
    });
    return res.redirect(redirectUrl);
  }

  return res.status(status).send({ status, message, error: code });
};
