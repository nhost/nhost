import { Router } from "express";
import { createValidator } from "express-joi-validation";

import { asyncWrapper as aw } from "@/helpers";
import { userActivateSchema } from "@/validation";
import { userActivateHandler } from "./activate";

const router = Router();

router.post(
  "/user/activate",
  createValidator().body(userActivateSchema),
  aw(userActivateHandler)
);

const userRouter = router;
export { userRouter };
