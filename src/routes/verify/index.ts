import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { verifyHandler } from './verify';

const router = Router();

/**
 * GET /verify
 * @summary Verify tickets created by email verification, email passwordless authentication, or password reset
 * @param {string} ticket.query.required - Ticket generated in the previous actions and sent by email
 * @param {string} type.query.required - name param description - enum:emailVerify,emailConfirmChange,signinPasswordless,passwordReset
 * @param {string} redirectTo.query.required - Redirection link
 * @return {string} 302 - {redirectTo}#refreshToken=${refreshToken}&type=${type}
 * @return {string} 400 - The payload format is invalid - application/json
 * @tags General
 */
// TODO use Joi
router.get('/verify', aw(verifyHandler));

const verifyRouter = router;
export { verifyRouter };
