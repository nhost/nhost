import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';

import { signInAnonymousHandler, signInAnonymousSchema } from './anonymous';
import { signInMfaTotpHandler, signInMfaTotpSchema } from './mfa';
import {
  signInPasswordlessSmsHandler,
  signInPasswordlessSmsSchema,
} from './passwordless';
import { signInOtpHandler, signInOtpSchema } from './passwordless/sms/otp';
import {
  signInVerifyWebauthnHandler,
  signInVerifyWebauthnSchema,
  signInWebauthnHandler,
  signInWebauthnSchema,
} from './webauthn';

const router = Router();


/**
 * POST /signin/passwordless/sms
 * @summary Send a one-time password by SMS
 * @param {SignInPasswordlessSmsSchema} request.body.required
 * @return {string} 200 - SMS sent successfully - application/json
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

// TODO add @return payload on success
/**
 * POST /signin/webauthn
 * @summary Sign in using email via FIDO2 Webauthn authentication
 * @param {SignInWebauthnSchema} request.body.required
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/webauthn',
  bodyValidator(signInWebauthnSchema),
  aw(signInWebauthnHandler)
);

/**
 * POST /signin/webauthn/verify
 * @summary Verfiy FIDO2 Webauthn authentication using public-key cryptography
 * @param {SignInVerifyWebauthnSchema} request.body.required
 * @return {SessionPayload} 200 - Signed in successfully - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Invalid email or password, or user is not verified - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signin/webauthn/verify',
  bodyValidator(signInVerifyWebauthnSchema),
  aw(signInVerifyWebauthnHandler)
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
