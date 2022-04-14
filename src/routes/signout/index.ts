import { Router } from 'express';
import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { signOutHandler, signOutSchema } from './signout';

const router = Router();

/**
 * POST /signout
 * @summary Sign out
 * @param {SignOutSchema} request.body.required
 * @return {string} 200 - Successfully signed out - text/plain
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthenticatedUserError} 401 - User must be signed in to sign out from all sessions - application/json
 * @security BearerAuth
 * @tags Sign out
 */
router.post('/signout', bodyValidator(signOutSchema), aw(signOutHandler));

const signOutRouter = router;
export { signOutRouter };
