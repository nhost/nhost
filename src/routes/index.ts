import { Router } from "express";
import nocache from "nocache";
import changeEmail from "./change-email";
import loginAccount from "./login";
import logout from "./logout";
import mfa from "./mfa";
import changePassword from "./change-password";
import providers from "./providers";
import registerAccount from "./register";
import token from "./token";
import activateAccount from "./activate";
import deleteAccount from "./delete";
import magicLink from "./magic-link";
import whitelist from "./whitelist";
import resendConfirmation from "./resend-confirmation";
import deanonymize from "./deanonymize";
import changeLocale from "./change-locale";
import env from "./env";
import boom = require("express-boom");
import { signUpRouter } from "./signup";

const router = Router();

router.use(boom());

router.use(nocache());

router.get("/healthz", (_req, res) => res.send("OK"));

router.get("/version", (_req, res) =>
  res.send(JSON.stringify({ version: "v" + process.env.npm_package_version }))
);

router.use(signUpRouter);

// providers(router);
// mfa(router);
// changeEmail(router);
// activateAccount(router);
// deleteAccount(router);
// loginAccount(router);
// logout(router);
// registerAccount(router);
// changePassword(router);
// getJwks(router);
// token(router);
// magicLink(router);
// whitelist(router);
// resendConfirmation(router);
// deanonymize(router);
// changeLocale(router);
env(router);

// all other routes should throw 404 not found
router.use("*", (rwq, res) => {
  return res.boom.notFound();
});

export default router;
