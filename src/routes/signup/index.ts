import { asyncWrapper as aw } from "@/helpers";
import { signUpEmailPasswordSchema } from "@/validation";
import { Router } from "express";
import { createValidator } from "express-joi-validation";
import { signUpEmailPasswordHandler } from "./email-password";

const router = Router();

router.post(
  "/signup/email-password",
  createValidator().body(signUpEmailPasswordSchema),
  aw(signUpEmailPasswordHandler)
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

const signUpRouter = router;
export { signUpRouter };
