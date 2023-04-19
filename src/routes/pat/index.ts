import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';
import { Router } from 'express';
import { createPATHandler, createPATSchema } from './pat';

const router = Router();

/**
 * POST /pat
 * @summary Create a Personal Access Token (PAT)
 * @param {CreatePATSchema} request.body.required
 * @return {SessionModel} 200 - User successfully authenticated - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Unauthenticated user or invalid token - application/json
 * @tags General
 */
router.post('/pat', bodyValidator(createPATSchema), aw(createPATHandler));

const patRouter = router;
export { patRouter };
