import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  signInEmailPasswordSchema,
  signInMagicLinkSchema,
  signInAnonymousSchema,
  signInMagicLinkOtpSchema,
  signInMfaTotpSchema,
} from '@/validation';
import { signInEmailPasswordHandler } from './email-password';
import {
  signInMagicLinkHandler,
  signInMagicLinkOtpHandler,
} from './magic-link';
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

router.post(
  '/signin/magic-link/otp',
  createValidator().body(signInMagicLinkOtpSchema),
  aw(signInMagicLinkOtpHandler)
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

providers(router);

const signInRouter = router;
export { signInRouter };
