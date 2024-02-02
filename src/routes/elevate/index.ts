import { Router } from 'express';

import { asyncWrapper as aw } from '@/utils';
import { bodyValidator } from '@/validation';

import {
  elevateVerifyWebauthnHandler,
  elevateVerifyWebauthnSchema,
  elevateWebauthnHandler,
  elevateWebauthnSchema,
} from './webauthn';

const router = Router();

// TODO add @return payload on success
/**
 * POST /elevate/webauthn
 * @summary Elevate access for an already signed in user using FIDO2 Webauthn
 * @param {ElevateWebauthnSchema} request.body.required
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/elevate/webauthn',
  bodyValidator(elevateWebauthnSchema),
  aw(elevateWebauthnHandler)
);

/**
 * POST /elevate/webauthn/verify
 * @summary Verfiy FIDO2 Webauthn authentication using public-key cryptography
 * @param {ElevateVerifyWebauthnSchema} request.body.required
 * @return {SessionPayload} 200 - Signed in successfully - application/json
 * @return {InvalidRequestError} 400 - The payload is invalid - application/json
 * @return {UnauthorizedError} 401 - Invalid email or password, or user is not verified - application/json
 * @return {DisabledEndpointError} 404 - The feature is not activated - application/json
 * @tags Authentication
 */
router.post(
  '/elevate/webauthn/verify',
  bodyValidator(elevateVerifyWebauthnSchema),
  aw(elevateVerifyWebauthnHandler)
);

const elevateRouter = router;
export { elevateRouter };
