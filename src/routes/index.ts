import * as express from "express";
import * as path from "path";
import boom = require("express-boom");
import nocache from "nocache";

import { signUpRouter } from "./signup";
import { signInRouter } from "./signin";
import { userRouter } from "./user";
import env from "./env";
import { mfaRouter } from "./mfa";
import { tokenRouter } from "./token";

const router = express.Router();
router.use(boom());
router.use(nocache());

router.get("/healthz", (_req, res) => res.send("OK"));
router.get("/version", (_req, res) =>
  res.send(JSON.stringify({ version: "v" + process.env.npm_package_version }))
);

// serve actions from action folder
// router.use(serveStatic(`action`));
router.use(express.static(path.join(process.cwd(), "src/public")));

router.use(signUpRouter);
router.use(signInRouter);
router.use(userRouter);
router.use(mfaRouter);
router.use(tokenRouter);

env(router);

// all other routes should throw 404 not found
router.use("*", (rwq, res) => {
  return res.send("fail");
  // return res.boom.notFound();
});

export default router;
