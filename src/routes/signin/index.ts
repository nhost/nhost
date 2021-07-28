import { Router } from "express";
import { createValidator } from "express-joi-validation";

import { asyncWrapper as aw } from "@/helpers";
import {
  signInEmailPasswordSchema,
  signInMagicLinkSchema,
  signInMagicLinkCallbackSchema,
  signInMFATOTPSchema,
} from "@/validation";
import { signInEmailPasswordHandler } from "./email-password";
import { signInMagicLinkHandler } from "./magic-link";
import { signInMagicLinkCallbackHandler } from "./magic-link-callback";
import { signInMFATOTOPHandler } from "./mfa/totp";

const router = Router();

router.post(
  "/signin/email-password",
  createValidator().body(signInEmailPasswordSchema),
  aw(signInEmailPasswordHandler)
);

router.post(
  "/signin/magic-link",
  createValidator().body(signInMagicLinkSchema),
  aw(signInMagicLinkHandler)
);

router.post(
  "/signin/magic-link/callback",
  createValidator().body(signInMagicLinkCallbackSchema),
  aw(signInMagicLinkCallbackHandler)
);

router.post(
  "/signin/mfa/totp",
  createValidator().body(signInMFATOTPSchema),
  aw(signInMFATOTOPHandler)
);

// router.post(
//   "/signup/magic-link/callback",
//   createValidator().body(registerSchema),
//   aw(signUpMagicLinkCallbackHandler)
// );

// router.post(
//   "/signup/send-activation-email",
//   createValidator().body(registerSchema),
//   aw(signUpSendActivationEmail)
// );

const signInRouter = router;
export { signInRouter };
