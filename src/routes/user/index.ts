import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { authenticationGate } from '@/middleware/auth';

import { userMFAHandler, userMfaSchema } from './mfa';
import { userHandler } from './user';
import {
  userProviderTokensHandler,
  userProviderTokensSchema,
} from './provider-tokens';
import {
  addSecurityKeyHandler,
  addSecurityKeyVerifyHandler,
  userVerifyAddSecurityKeySchema,
} from './webauthn';

const router = Router();

/**
 * GET /user
 * @summary Get user information
 * @return {User} 200 - User information - application/json
 * @return {UnauthenticatedUserError} 401 - User is not authenticated - application/json
 * @security BearerAuth
 * @tags User management
 */
router.get(
    '/user',
    authenticationGate(false),
    aw(userHandler),
);

/**
 * POST /user/mfa
 * @summary Activate/deactivate Multi-factor authentication
 * @param {UserMfaSchema} request.body.required
 * @return {string} 200 - Success - application/json
 * @return {InvalidRequestError} 400 - The payload format is invalid - application/json
 * @return {UnauthenticatedUserError} 401 - User is not authenticated - application/json
 * @security BearerAuth
 * @tags Authentication
 */
router.post(
  '/user/mfa',
  bodyValidator(userMfaSchema),
  authenticationGate(true),
  aw(userMFAHandler)
);

/**
 * POST /user/provider/tokens
 * @summary Refresh the Oauth access tokens of a given user. You must be an admin to perform this operation.
 * @param {UserProviderTokensSchema} request.body.required
 * @param {string} x-hasura-admin-secret.header.required - Hasura admin secret
 * @return {string} 200 - Success - application/json
 * @return {InvalidRequestError} 400 - The payload format is invalid - application/json
 * @return {InvalidAdminSecretError} 401 - Incorrect admin secret header - application/json
 * @tags User management
 */
router.post(
  '/user/provider/tokens',
  bodyValidator(userProviderTokensSchema),
  aw(userProviderTokensHandler)
);

// TODO add body validator
// TODO add @return payload on success
/**
 * POST /user/webauthn/add
 * @summary Initialize adding of a new webauthn security key (device, browser)
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Invalid email or password, or user is not verified - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags User management
 */
router.post(
  '/user/webauthn/add',
  authenticationGate(true, true),
  aw(addSecurityKeyHandler),
);

// TODO add @return payload on success
/**
 * POST /user/webauthn/verify
 * @summary Verfiy adding of a new webauth security key (device, browser)
 * @param {VerifyAddSecurityKeySchema} request.body.required
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Invalid email or password, or user is not verified - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags User management
 */
router.post(
  '/user/webauthn/verify',
  bodyValidator(userVerifyAddSecurityKeySchema),
  aw(addSecurityKeyVerifyHandler)
);

const userRouter = router;
export { userRouter };
