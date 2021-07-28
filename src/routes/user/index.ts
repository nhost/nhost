import { Router } from "express";
import { createValidator } from "express-joi-validation";

import { asyncWrapper as aw } from "@/helpers";
import {
  userActivateSchema,
  userMFASchema,
  userPasswordResetSchema,
  userPasswordSchema,
} from "@/validation";
import { userActivateHandler } from "./activate";
import { userMFAHandler } from "./mfa";
import { userHandler } from "./user";
import { userPasswordHandler } from "./password";
import { userPasswordResetHandler } from "./password-reset";

const router = Router();

router.get("/user", aw(userHandler));

router.post(
  "/user/password/reset",
  createValidator().body(userPasswordResetSchema),
  aw(userPasswordResetHandler)
);

router.post(
  "/user/password",
  createValidator().body(userPasswordSchema),
  aw(userPasswordHandler)
);

router.post(
  "/user/activate",
  createValidator().body(userActivateSchema),
  aw(userActivateHandler)
);

router.post(
  "/user/mfa",
  createValidator().body(userMFASchema),
  aw(userMFAHandler)
);

const userRouter = router;
export { userRouter };
