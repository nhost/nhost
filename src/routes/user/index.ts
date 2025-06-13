import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { authenticationGate } from '@/middleware/auth';

import { userHandler } from './user';
import {
  userProviderTokensHandler,
  userProviderTokensSchema,
} from './provider-tokens';

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

const userRouter = router;
export { userRouter };
