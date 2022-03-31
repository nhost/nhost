import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';

import {
  signInEmailPasswordHandler,
  signInEmailPasswordSchema,
} from './email-password';
import { signInAnonymousHandler, signInAnonymousSchema } from './anonymous';
import providers from './providers';
import { signInOtpHandler, signInOtpSchema } from './passwordless/sms/otp';
import {
  signInPasswordlessEmailHandler,
  signInPasswordlessEmailSchema,
  signInPasswordlessSmsHandler,
  signInPasswordlessSmsSchema,
} from './passwordless';
import { signInMfaTotpHandler, signInMfaTotpSchema } from './mfa';

const router = Router();

/**
 * POST /signin/email-password
 * @summary Authenticate with email + password
 * @param {SignInEmailPasswordSchema} request.body.required
 * @return {SessionPayload} 200 - Signed in successfully - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Invalid email or password, or user is not verified - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/email-password',
  bodyValidator(signInEmailPasswordSchema),
  aw(signInEmailPasswordHandler)
);

/**
 * POST /signin/passwordless/email
 * @summary Email passwordless authentication
 * @param {SignInPasswordlessEmailSchema} request.body.required
 * @return {string} 200 - Email sent successfully - text/plain
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledUserError} 401 - User is disabled - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/passwordless/email',
  bodyValidator(signInPasswordlessEmailSchema),
  aw(signInPasswordlessEmailHandler)
);

/**
 * POST /signin/passwordless/sms
 * @summary Send a one-time password by SMS
 * @param {SignInPasswordlessSmsSchema} request.body.required
 * @return {string} 200 - SMS sent successfully - text/plain
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/passwordless/sms',
  bodyValidator(signInPasswordlessSmsSchema),
  aw(signInPasswordlessSmsHandler)
);

/**
 * POST /signin/passwordless/sms/otp
 * @summary Passwordless authentication from a one-time password code received by SMS
 * @param {SignInOtpSchema} request.body.required
 * @return {SessionPayload} 200 - User successfully authenticated - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Error processing the request - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/passwordless/sms/otp',
  bodyValidator(signInOtpSchema),
  aw(signInOtpHandler)
);

/**
 * POST /signin/anonymous
 * @summary Anonymous authentication
 * @param {SignInAnonymousSchema} request.body.required
 * @return {SessionPayload} 200 - User successfully authenticated - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/anonymous',
  bodyValidator(signInAnonymousSchema),
  aw(signInAnonymousHandler)
);

// sign in using providers
providers(router);

/**
 * POST /signin/mfa/totp
 * @summary Sign in with a Time-base One-Time Password (TOTP) ticket
 * @param {SignInMfaTotpSchema} request.body.required
 * @return {SessionPayload} 200 - User successfully authenticated - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/mfa/totp',
  bodyValidator(signInMfaTotpSchema),
  aw(signInMfaTotpHandler)
);

// TODO: Implement:
// router.post(
//   '/signin/mfa/sms',
//   bodyValidator(signInMfaSmsSchema),
//   aw(signInMfaSmsHandler)
// );

const signInRouter = router;
export { signInRouter };
