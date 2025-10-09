import { StatusCodes } from 'http-status-codes';


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
  [K in keyof T]: Pick<ErrorPayload, 'status' | 'message'> & {
    /**
     * Determines if the error can leak information about users to attackers.
     */
    sensitive?: boolean;
  };
}) => et;

export const ERRORS = asErrors({
  'bad-request': {
    status: StatusCodes.BAD_REQUEST,
    message: 'Bad Request',
  },
  'route-not-found': {
    status: StatusCodes.NOT_FOUND,
    message: 'Route not found',
  },
  'disabled-endpoint': {
    status: StatusCodes.CONFLICT,
    message: 'This endpoint is disabled',
  },
  'invalid-request': {
    status: StatusCodes.BAD_REQUEST,
    message: 'The request payload is incorrect',
  },
  'invalid-expiry-date': {
    status: StatusCodes.BAD_REQUEST,
    message: 'The expiry date must be greater than the current date',
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
    sensitive: true,
  },
  'invalid-email-password': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Incorrect email or password',
    sensitive: true,
  },
  'invalid-otp': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired OTP',
  },
  'invalid-ticket': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired verification ticket',
  },
  'invalid-webauthn-security-key': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid WebAuthn security key',
  },
  'invalid-webauthn-verification': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid WebAuthn verification',
  },
  'unverified-user': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Email is not verified',
  },
  'email-already-in-use': {
    status: StatusCodes.CONFLICT,
    message: 'Email already in use',
    sensitive: true,
  },
  'mfa-type-not-found': {
    status: StatusCodes.BAD_REQUEST,
    message: 'There is no active MFA set for the user',
  },
  'email-already-verified': {
    status: StatusCodes.BAD_REQUEST,
    message: "User's email is already verified",
    sensitive: true,
  },
  'totp-already-active': {
    status: StatusCodes.BAD_REQUEST,
    message: 'TOTP MFA already active',
  },
  'user-not-found': {
    status: StatusCodes.BAD_REQUEST,
    message: 'No user found',
    sensitive: true,
  },
  'user-not-anonymous': {
    status: StatusCodes.BAD_REQUEST,
    message: 'Logged in user is not anonymous',
  },
  'forbidden': {
    status: StatusCodes.FORBIDDEN,
    message: 'Forbidden',
  },
  'forbidden-anonymous': {
    status: StatusCodes.FORBIDDEN,
    message: 'Anonymous users cannot access this endpoint',
  },
  'invalid-refresh-token': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired refresh token',
  },
  'invalid-pat': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid or expired personal access token',
  },
  'invalid-admin-secret': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'Invalid admin secret',
  },
  'unauthenticated-user': {
    status: StatusCodes.UNAUTHORIZED,
    message: 'User is not logged in',
  },
  'elevated-claim-required': {
    status: StatusCodes.FORBIDDEN,
    message: 'Elevated claim is required',
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
  'internal-error': {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  },
  'invalid-oauth-configuration': {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Invalid OAuth configuration',
  },
  'signup-disabled': {
    status: StatusCodes.FORBIDDEN,
    message: 'Sign up is disabled.',
  },
});
