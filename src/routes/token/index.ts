import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import { tokenSchema } from '@/validation';
import { tokenHandler } from './token';

const router = Router();

/**
 * POST /token
 * @summary Refresh the access token (JWT) and the refresh token
 * @param {TokenSchema} request.body.required
 * @return {SessionPayload} 200 - User successfully authenticated - application/json
 * @return {string} 400 - The payload is invalid - text/plain
 * @return {object} 401 - User is not authorized to refresh the token - application/json
 * @tags General
 */
router.post('/token', createValidator().body(tokenSchema), aw(tokenHandler));

const tokenRouter = router;
export { tokenRouter };
