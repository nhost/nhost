import * as express from 'express';
import nocache from 'nocache';
import env from './env';
import { signOutRouter } from './signout';
import { tokenRouter } from './token';
import { userRouter } from './user';
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
router.use(signOutRouter);
router.use(userRouter);
router.use(tokenRouter);

// admin
env(router);

export default router;
