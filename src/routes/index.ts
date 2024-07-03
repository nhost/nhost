import * as express from 'express';
import nocache from 'nocache';
import env from './env';
import { mfaRouter } from './mfa';
import { oauthProviders } from './oauth';
import { signInRouter } from './signin';
import { elevateRouter } from './elevate';
import { signOutRouter } from './signout';
import { tokenRouter } from './token';
import { userRouter } from './user';
import { verifyRouter } from './verify';
import { ENV } from '../utils/env';

const router = express.Router();
router.use(nocache());

/**
 * GET /version
 * @summary Get the current Hasura-auth version
 * @return {Version} 200 - Hasura auth version - application/json
 * @tags General
 */
router.get('/version', (_req, res) =>
  res.json({ version: ENV.AUTH_VERSION })
);

// auth routes
router.use(signInRouter);
router.use(signOutRouter);
router.use(elevateRouter);
router.use(userRouter);
router.use(mfaRouter);
router.use(tokenRouter);
router.use(verifyRouter);

// admin
env(router);

router.use(oauthProviders);

export default router;
