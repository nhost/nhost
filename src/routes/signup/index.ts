import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import {
  signUpEmailPasswordHandler,
  signUpEmailPasswordSchema,
} from './email-password';
import { bodyValidator } from '@/validation';
import {
  signUpVerifyWebauthnHandler,
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

/**
 * POST /signup/webauthn
 * @summary Signup new device for a email using FIDO2 Webauthn
 * @param {SignUpWebauthnSchema} request.body.required
 * TODO add @return payload on success
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @tags Registration
 */
router.post(
  '/signup/webauthn',
  bodyValidator(signUpWebauthnSchema),
  aw(signUpWebauthnHandler)
);

/**
 * POST /signup/webauthn/verify
 * @summary Verify signup with FIDO2 Webauthn
 * @param {SignUpVerifyWebauthnSchema} request.body.required
 * @return {SessionPayload} 200 - Successfully registered. Null session means email verification is pending - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @tags Registration
 */
router.post(
  '/signup/webauthn/verify',
  bodyValidator(signUpVerifyWebauthnSchema),
  aw(signUpVerifyWebauthnHandler)
);

// WARNING: alias route for `/signin/magic-link`
// router.post(
//   '/signup/magic-link',
//   bodyValidator(signInMagicLinkSchema),
//   aw(signInMagicLinkHandler)
// );

const signUpRouter = router;
export { signUpRouter };
