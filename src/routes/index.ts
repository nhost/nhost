import * as express from 'express';
import nocache from 'nocache';

import { sendError } from '@/errors';
import { signUpRouter } from './signup';
import { signInRouter } from './signin';
import { userRouter } from './user';
import { mfaRouter } from './mfa';
import { tokenRouter } from './token';
import { signOutRouter } from './signout';
import env from './env';
import { verifyRouter } from './verify';

const router = express.Router();
router.use(nocache());

/**
 * GET /healthz
 * @summary Check if the server is up and running
 * @return 200 - success response - text/plain
 * @tags General
 */
router.get('/healthz', (_req, res) => res.send('ok'));

/**
 * GET /version
 * @summary Get the current Hasura-auth version
 * @return {string} 200 - success response - text/plain
 * @tags General
 */
router.get('/version', (_req, res) =>
  res.send(JSON.stringify({ version: 'v' + process.env.npm_package_version }))
);

// auth routes
router.use(signUpRouter);
router.use(signInRouter);
router.use(signOutRouter);
router.use(userRouter);
router.use(mfaRouter);
router.use(tokenRouter);
router.use(verifyRouter);

// admin
env(router);

// all other routes should throw 404 not found
router.use('*', (rwq, res) => {
  return sendError(res, 'route-not-found');
});

export default router;
