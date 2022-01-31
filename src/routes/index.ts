import * as express from 'express';
import boom = require('express-boom');
import nocache from 'nocache';

import { signUpRouter } from './signup';
import { signInRouter } from './signin';
import { userRouter } from './user';
import { mfaRouter } from './mfa';
import { tokenRouter } from './token';
import { signOutRouter } from './signout';
import env from './env';
import { verifyRouter } from './verify';

const router = express.Router();
router.use(boom());
router.use(nocache());

router.get('/healthz', (_req, res) => res.send('OK'));
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
  return res.boom.notFound('Route not found');
});

export default router;
