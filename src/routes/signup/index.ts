import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import {
  signUpEmailPasswordHandler,
  signUpEmailPasswordSchema,
} from './email-password';
import { bodyValidator } from '@/validation';
import {
  signInVerifyWebauthnHandler,
  signUpVerifyWebauthnSchema,
  signUpWebauthnHandler,
  signUpWebauthnSchema,
} from './webauthn';

const router = Router();

/**
 * POST /signup/email-password
 * @summary Signup with email and password
 * @param {SignUpEmailPasswordSchema} request.body.required
 * @return {SessionPayload} 200 - Successfully registered. Null session means email verification is pending - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {EmailAlreadyInUseError} 409 - Email is already present in the database - application/json
 * @tags Registration
 */
router.post(
  '/signup/email-password',
  bodyValidator(signUpEmailPasswordSchema),
  aw(signUpEmailPasswordHandler)
);

// TODO add @return payload on success
// TODO document possible errors
/**
 * POST /signup/webauthn
 * @summary Sign up using email via FIDO2 Webauthn authentication
 * @param {SignUpWebauthnSchema} request.body.required
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signup/webauthn',
  bodyValidator(signUpWebauthnSchema),
  aw(signUpWebauthnHandler)
);

// TODO document possible errors
/**
 * POST /signup/webauthn/verify
 * @summary Verfiy FIDO2 Webauthn authentication and complete signup
 * @param {SignUpVerifyWebauthnSchema} request.body.required
 * @return {SessionPayload} 200 - Signed in successfully - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/signup/webauthn/verify',
  bodyValidator(signUpVerifyWebauthnSchema),
  aw(signInVerifyWebauthnHandler)
);

const signUpRouter = router;
export { signUpRouter };
