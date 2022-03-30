import { Router } from 'express';
import { asyncWrapper as aw } from '@/utils';
import { authenticationGate } from '@/middleware/auth';

import { mfatotpGenerateHandler } from './totp-generate';

const router = Router();

/**
 * GET /mfa/totp/generate
 * @summary Generate a secret to request the activation of Time-based One-Time Password (TOTP) multi-factor authentication
 * @return {TotpPayload} 200 - Success - application/json
 * @return {UnauthenticatedError} 401 - User is not authenticated
 * @return {string} 404 - The feature is not activated - text/plain
 * @security BearerAuth
 * @tags User management
 */
router.get(
  '/mfa/totp/generate',
  authenticationGate,
  aw(mfatotpGenerateHandler)
);

const mfaRouter = router;
export { mfaRouter };
