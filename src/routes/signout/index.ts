import { Router } from 'express';
import { asyncWrapper as aw } from '@/helpers';
import { createValidator } from 'express-joi-validation';
import { signOutSchema } from '@/validation';
import { signOutHandler } from './signout';

const router = Router();

/**
 * POST /signout
 * @summary Sign out
 * @param {SignOutSchema} request.body.required
 * @return {string} 200 - Successfully signed out - text/plain
 * @return {string} 400 - The payload is invalid - text/plain
 * @return {string} 401 - User must be signed in to sign out from all sessions - application/json
 * @security BearerAuth
 * @tags Sign out
 */
router.post(
  '/signout',
  createValidator().body(signOutSchema),
  aw(signOutHandler)
);

const signOutRouter = router;
export { signOutRouter };
