import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  signInEmailPasswordSchema,
  signInMagicLinkSchema,
  signInAnonymousSchema,
  signInMfaTotpSchema,
} from '@/validation';
import { signInEmailPasswordHandler } from './email-password';
import { signInMagicLinkHandler } from './magic-link';
import { signInAnonymousHandler } from './anonymous';
import providers from './providers';
import { signInMfaTotpHandler } from './mfa';

const router = Router();

router.post(
  '/signin/email-password',
  createValidator().body(signInEmailPasswordSchema),
  aw(signInEmailPasswordHandler)
);

router.post(
  '/signin/magic-link',
  createValidator().body(signInMagicLinkSchema),
  aw(signInMagicLinkHandler)
);

// router.post(
//   '/signin/phone-number',
//   createValidator().body(signInMagicLinkSchema),
//   aw(signInMagicLinkHandler)
// );

// router.post(
//   '/signin/phone-number/otp',
//   createValidator().body(signInMagicLinkOtpSchema),
//   aw(signInMagicLinkOtpHandler)
// );

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

// router.post(
//   '/signin/mfa/sms',
//   createValidator().body(signInMfaSmsSchema),
//   aw(signInMfaSmsHandler)
// );

// providers
providers(router);

const signInRouter = router;
export { signInRouter };
