import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { verifyHandler, verifySchema } from './verify';
import { queryValidator } from '@/validation';

const router = Router();

// TODO: use VerifySchema in the jsdoc
/**
 * GET /verify
 * @summary Verify tickets created by email verification, email passwordless authentication, or password reset
 * @param {string} ticket.query.required - Ticket generated in the previous actions and sent by email
 * @param {string} type.query.required - name param description - enum:emailVerify,emailConfirmChange,signinPasswordless,passwordReset
 * @param {string} redirectTo.query.required - Redirection link
 * @return {string} 302 - {redirectTo}?refreshToken=${refreshToken}&type=${type}
 * @return {InvalidRequestError} 400 - The payload format is invalid - application/json
 * @tags General
 */
router.get('/verify', queryValidator(verifySchema), aw(verifyHandler));

const verifyRouter = router;
export { verifyRouter };
