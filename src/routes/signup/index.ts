import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import {
  signUpEmailPasswordHandler,
  signUpEmailPasswordSchema,
} from './email-password';
import { bodyValidator } from '@/validation';

const router = Router();

/**
 * POST /signup/email-password
 * @summary Signup with email and password
 * @param {SignUpEmailPasswordSchema} request.body.required
 * @return {SessionPayload} 200 - Successfully registered. Null session means email verification is pending - application/json
 * @return {string} 400 - The payload is invalid - text/plain
 * @return {EmailAlreadyInUseError} 409 - Email is already present in the database
 * @tags Registration
 */
router.post(
  '/signup/email-password',
  bodyValidator(signUpEmailPasswordSchema),
  aw(signUpEmailPasswordHandler)
);

// WARNING: alias route for `/signin/magic-link`
// router.post(
//   '/signup/magic-link',
//   bodyValidator(signInMagicLinkSchema),
//   aw(signInMagicLinkHandler)
// );

const signUpRouter = router;
export { signUpRouter };
