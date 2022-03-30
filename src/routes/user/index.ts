import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { userMFAHandler, userMfaSchema } from './mfa';
import { userHandler } from './user';
import { userPasswordHandler, userPasswordSchema } from './password';
import {
  userPasswordResetHandler,
  userPasswordResetSchema,
} from './password-reset';
import { userDeanonymizeHandler, userDeanonymizeSchema } from './deanonymize';
import {
  userProviderTokensHandler,
  userProviderTokensSchema,
} from './provider-tokens';
import {
  userEmailChangeSchema,
  userEmailSendVerificationEmailHandler,
  userEmailSendVerificationEmailSchema,
} from './email';
import { userEmailChange } from './email';
import { authenticationGate } from '@/middleware/auth';

const router = Router();

/**
 * GET /user
 * @summary Get user information
 * @return {User} 200 - User information - application/json
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @security BearerAuth
 * @tags User management
 */
router.get('/user', authenticationGate, aw(userHandler));

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
  bodyValidator(userPasswordResetSchema),
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
  bodyValidator(userPasswordSchema),
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
  bodyValidator(userEmailSendVerificationEmailSchema),
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
  bodyValidator(userEmailChangeSchema),
  authenticationGate,
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
 */
router.post('/user/mfa', bodyValidator(userMfaSchema), aw(userMFAHandler));

/**
 * POST /user/deanonymize
 * @summary 'Deanonymize' an anonymous user in adding missing email or email+password, depending on the chosen authentication method. Will send a confirmation email if the server is configured to do so.
 * @param {UserDeanonymizeSchema} request.body.required
 * @return {string} 200 - Success - text/plain
 * @return {string} 400 - The payload format is invalid - application/json
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @security BearerAuth
 * @tags Authentication
 */
router.post(
  '/user/deanonymize',
  bodyValidator(userDeanonymizeSchema),
  authenticationGate,
  aw(userDeanonymizeHandler)
);

/**
 * POST /user/provider/tokens
 * @summary Refresh the Oauth access tokens of a given user. You must be an admin to perform this operation.
 * @param {UserProviderTokensSchema} request.body.required
 * @param {string} x-hasura-admin-secret.header.required - Hasura admin secret
 * @return {string} 200 - Success - text/plain
 * @return {string} 400 - The payload format is invalid - application/json
 * @return {UnauthenticatedError} 401 - Incorrect admin secret header
 * @tags User management
 */
router.post(
  '/user/provider/tokens',
  bodyValidator(userProviderTokensSchema),
  aw(userProviderTokensHandler)
);

const userRouter = router;
export { userRouter };
