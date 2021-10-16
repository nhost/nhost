import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  signInEmailPasswordSchema,
  signInAnonymousSchema,
  signInMfaTotpSchema,
  signInOtpSchema,
  signInPasswordlessEmailSchema,
  signInPasswordlessSmsSchema,
} from '@/validation';
import { signInEmailPasswordHandler } from './email-password';
import { signInAnonymousHandler } from './anonymous';
import providers from './providers';
import { signInOtpHandler } from './passwordless/sms/otp';
import {
  signInPasswordlessEmailHandler,
  signInPasswordlessSmsHandler,
} from './passwordless';
import { signInMfaTotpHandler } from './mfa';

const router = Router();

router.post(
  '/signin/email-password',
  createValidator().body(signInEmailPasswordSchema),
  aw(signInEmailPasswordHandler)
);

router.post(
  '/signin/passwordless/email',
  createValidator().body(signInPasswordlessEmailSchema),
  aw(signInPasswordlessEmailHandler)
);

router.post(
  '/signin/passwordless/sms',
  createValidator().body(signInPasswordlessSmsSchema),
  aw(signInPasswordlessSmsHandler)
);

router.post(
  '/signin/passwordless/sms/otp',
  createValidator().body(signInOtpSchema),
  aw(signInOtpHandler)
);

router.post(
  '/signin/anonymous',
  createValidator().body(signInAnonymousSchema),
  aw(signInAnonymousHandler)
);

// sign in using providers
providers(router);

router.post(
  '/signin/mfa/totp',
  createValidator().body(signInMfaTotpSchema),
  aw(signInMfaTotpHandler)
);

// TODO: Implement:
// router.post(
//   '/signin/mfa/sms',
//   createValidator().body(signInMfaSmsSchema),
//   aw(signInMfaSmsHandler)
// );

const signInRouter = router;
export { signInRouter };
