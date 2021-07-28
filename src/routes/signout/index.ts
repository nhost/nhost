import { Router } from "express";
import { asyncWrapper as aw } from "@/helpers";
import { createValidator } from "express-joi-validation";
import { signOutSchema } from "@/validation";
import { signOutHandler } from "./signout";

const router = Router();

router.post(
  "/signout",
  createValidator().body(signOutSchema),
  aw(signOutHandler)
);

const signOutRouter = router;
export { signOutRouter };
