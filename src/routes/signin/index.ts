import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  signInEmailPasswordSchema,
  signInMagicLinkSchema,
  signInAnonymousSchema,
} from '@/validation';
import { signInEmailPasswordHandler } from './email-password';
import { signInMagicLinkHandler } from './magic-link';
import { signInAnonymousHandler } from './anonymous';
import providers from './providers';
import { signInOtpHandler, signInOtpSchema } from './otp';

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
  '/signin/otp',
  createValidator().body(signInOtpSchema),
  aw(signInOtpHandler)
);

router.post(
  '/signin/anonymous',
  createValidator().body(signInAnonymousSchema),
  aw(signInAnonymousHandler)
);

providers(router);

const signInRouter = router;
export { signInRouter };
