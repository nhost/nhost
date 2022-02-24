import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  userDeanonymizeSchema,
  userEmailChangeSchema,
  userEmailSendVerificationEmailSchema,
  userPasswordResetSchema,
  userPasswordSchema,
  userProviderTokensSchema,
} from '@/validation';
import { userMFAHandler } from './mfa';
import { userHandler } from './user';
import { userPasswordHandler } from './password';
import { userPasswordResetHandler } from './password-reset';
import { userDeanonymizeHandler } from './deanonymize';
import { userProviderTokensHandler } from './provider-tokens';
import { userEmailSendVerificationEmailHandler } from './email';
import { userEmailChange } from './email';

const router = Router();

/**
 * GET /user
 * @summary Get user information
 * @param {SignInAnonymousSchema} request.body.required
 * @return {User} 200 - User information - application/json
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @security BearerAuth
 * @tags User management
 */
router.get('/user', aw(userHandler));

/**
 * POST /user/password/reset
 * @summary Send an email asking the user to reset their password
 * @param {UserPasswordResetSchema} request.body.required
 * @return {string} 200 - The email to reset the password has been sent - text/plain
 * @return {string} 400 - The payload is invalid - text/plain
 * @tags User management
 */
router.post(
  '/user/password/reset',
  createValidator().body(userPasswordResetSchema),
  aw(userPasswordResetHandler)
);

/**
 * POST /user/password
 * @summary Set a new password
 * @param {UserPasswordSchema} request.body.required
 * @return {string} 200 - The password has been successfully changed - text/plain
 * @return {string} 400 - The payload is invalid - text/plain
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @security BearerAuth
 * @tags User management
 */
router.post(
  '/user/password',
  createValidator().body(userPasswordSchema),
  aw(userPasswordHandler)
);

/**
 * POST /user/email/send-verification-email
 * @summary Send an email to verify the account
 * @param {UserEmailSendVerificationEmailSchema} request.body.required
 * @return {string} 200 - OK - text/plain
 * @return {string} 400 - The payload format is invalid - text/plain
 * @tags User management
 */
router.post(
  '/user/email/send-verification-email',
  createValidator().body(userEmailSendVerificationEmailSchema),
  aw(userEmailSendVerificationEmailHandler)
);

/**
 * POST /user/email/change
 * @summary Change the current user's email
 * @param {UserEmailChangeSchema} request.body.required
 * @return {string} 200 - A verification email has been sent to the new email - text/plain
 * @return {string} 400 - The payload format is invalid - text/plain
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @security BearerAuth
 * @tags User management
 */
router.post(
  '/user/email/change',
  createValidator().body(userEmailChangeSchema),
  aw(userEmailChange)
);

/**
 * POST /user/mfa
 * @summary Activate/deactivate Multi-factor authentication
 * @param {UserMfaSchema} request.body.required
 * @return {string} 200 - Success - text/plain
 * @return {string} 400 - The payload format is invalid - application/json
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @security BearerAuth
 * @tags Authentication
 */ router.post(
  '/user/mfa',
  // ? why is validation deactivated?
  // createValidator().body(userMfaSchema),
  aw(userMFAHandler)
);

// TODO document API
router.post(
  '/user/deanonymize',
  createValidator().body(userDeanonymizeSchema),
  aw(userDeanonymizeHandler)
);

// TODO document API
router.post(
  '/user/provider/tokens',
  createValidator().body(userProviderTokensSchema),
  aw(userProviderTokensHandler)
);

const userRouter = router;
export { userRouter };
