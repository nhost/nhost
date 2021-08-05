import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import {
  userDeanonymizeSchema,
  userEmailResetSchema,
  userEmailSchema,
  userEmailSendVerificationEmailSchema,
  userPasswordResetSchema,
  userPasswordSchema,
  userProviderTokensSchema,
  userVerifyEmailSchema,
} from '@/validation';
import { userMFAHandler } from './mfa';
import { userHandler } from './user';
import { userPasswordHandler } from './password';
import { userPasswordResetHandler } from './password-reset';
import { userEmailHandler } from './email';
import { userEmailReset } from './email/reset';
import { userDeanonymizeHandler } from './deanonymize';
import { userProviderTokensHandler } from './provider-tokens';
import { userEmailVerifyHandler } from './email/verify';
import { userEmailSendVerificationEmailHandler } from './email/send-verification-email';

const router = Router();

router.get('/user', aw(userHandler));

router.post(
  '/user/password/reset',
  createValidator().body(userPasswordResetSchema),
  aw(userPasswordResetHandler)
);

router.post(
  '/user/password',
  createValidator().body(userPasswordSchema),
  aw(userPasswordHandler)
);

router.post(
  '/user/email/reset',
  createValidator().body(userEmailResetSchema),
  aw(userEmailReset)
);

router.post(
  '/user/email/send-verification-email',
  createValidator().body(userEmailSendVerificationEmailSchema),
  aw(userEmailSendVerificationEmailHandler)
);

router.post(
  '/user/email/verify',
  createValidator().body(userVerifyEmailSchema),
  aw(userEmailVerifyHandler)
);

router.post(
  '/user/email',
  createValidator().body(userEmailSchema),
  aw(userEmailHandler)
);

router.post(
  '/user/mfa',
  // createValidator().body(userMfaSchema),
  aw(userMFAHandler)
);

router.post(
  '/user/deanonymize',
  createValidator().body(userDeanonymizeSchema),
  aw(userDeanonymizeHandler)
);

router.post(
  '/user/provider/tokens',
  createValidator().body(userProviderTokensSchema),
  aw(userProviderTokensHandler)
);

const userRouter = router;
export { userRouter };
