import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { verifyTokenHandler, verifyTokenSchema } from './verify';

const router = Router();

/**
 * POST /token/verify
 * @summary Veify JWT token
 * @description If request body is not passed the autorization header will be used to be verified
 * @param {VerifyTokenSchema} request.body.optional
 * @return {string} 200 - Valid JWT token - application/json
 * @return {UnauthorizedError} 401 - Unauthenticated user or invalid token - application/json
 * @tags General
 */
router.post(
  '/token/verify',
  bodyValidator(verifyTokenSchema),
  aw(verifyTokenHandler)
);

const tokenRouter = router;
export { tokenRouter };
