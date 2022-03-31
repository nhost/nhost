import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { tokenHandler, tokenSchema } from './token';

const router = Router();

/**
 * POST /token
 * @summary Refresh the access token (JWT) and the refresh token
 * @param {TokenSchema} request.body.required
 * @return {SessionPayload} 200 - User successfully authenticated - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Unauthenticated user or invalid token - application/json
 * @tags General
 */
router.post('/token', bodyValidator(tokenSchema), aw(tokenHandler));

const tokenRouter = router;
export { tokenRouter };
