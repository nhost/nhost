import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  signInEmailPasswordSchema,
  signInAnonymousSchema,
  signInMfaTotpSchema,
  signInOtpSchema,
  signInPasswordlessSchema,
} from '@/validation';
import { signInEmailPasswordHandler } from './email-password';
import { signInAnonymousHandler } from './anonymous';
import providers from './providers';
import { signInMfaTotpHandler } from './mfa';
import { signInPasswordlessStartHandler } from './passwordless';
import { signInOtpHandler } from './otp';

const router = Router();

router.post(
  '/signin/email-password',
  createValidator().body(signInEmailPasswordSchema),
  aw(signInEmailPasswordHandler)
);

// magic link via email and sms
// code (otp) via email and sms
router.post(
  '/signin/passwordless/start',
  createValidator().body(signInPasswordlessSchema),
  aw(signInPasswordlessStartHandler)
);

router.post(
  '/signin/otp',
  createValidator().body(signInOtpSchema),
  aw(signInOtpHandler)
);

router.post(
  '/signin/anonymous',
  createValidator().body(signInAnonymousSchema),
  aw(signInAnonymousHandler)
);

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

// providers
providers(router);

const signInRouter = router;
export { signInRouter };
