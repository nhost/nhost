import { Request, Response, Router } from "express";
import { authenticator } from "otplib";
import { asyncWrapper, createQR, getUser } from "@/helpers";
import { MFA } from "@config/index";
import { gqlSdk } from "@/utils/gqlSDK";

async function generateMfa(req: Request, res: Response): Promise<unknown> {
  if (!req.auth) {
    return res.boom.unauthorized("Not logged in");
  }

  const { userId } = req.auth;

  const user = await getUser(userId);

  const { mfaEnabled } = user;

  if (mfaEnabled) {
    req.logger.verbose(
      `User ${userId} tried generating MFA but it was already enabled`,
      {
        userId,
      }
    );
    return res.boom.badRequest("MFA is already enabled");
  }

  /**
   * Generate OTP secret and key URI.
   */
  const otpSecret = authenticator.generateSecret();
  const otpAuth = authenticator.keyuri(userId, MFA.OTP_ISSUER, otpSecret);

  await gqlSdk.updateUser({
    id: userId,
    user: {
      otpSecret,
    },
  });

  const imageUrl = await createQR(otpAuth);

  req.logger.verbose(`User ${userId} generated an OTP sercret to enable MFA`, {
    userId,
  });

  return res.send({ imageUrl, otpSecret: otpSecret });
}

export default (router: Router) => {
  router.post("/generate", asyncWrapper(generateMfa));
};
