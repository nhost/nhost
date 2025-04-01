import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';

import {
  signInPasswordlessSmsHandler,
  signInPasswordlessSmsSchema,
} from './passwordless';
import { signInOtpHandler, signInOtpSchema } from './passwordless/sms/otp';

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

// TODO: Implement:
// router.post(
//   '/signin/mfa/sms',
//   bodyValidator(signInMfaSmsSchema),
//   aw(signInMfaSmsHandler)
// );

const signInRouter = router;
export { signInRouter };
