import { asyncWrapper, getUserById } from "@/helpers";
import { Response, Router } from "express";

import { authenticator } from "otplib";
import { MfaSchema, mfaSchema } from "@/validation";
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest,
} from "express-joi-validation";
import { gqlSdk } from "@/utils/gqlSDK";

async function enableMfa(
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> {
  if (!req.auth) {
    return res.boom.unauthorized("Not logged in");
  }

  const { userId } = req.auth;

  const { code } = req.body;

  const user = await getUserById(userId);

  const { otpSecret, mfaEnabled } = user;

  if (mfaEnabled) {
    req.logger.verbose(
      `User ${userId} tried enabling MFA but it was already enabled`,
      {
        userId,
      }
    );
    return res.boom.badRequest("MFA is already enabled");
  }

  if (!otpSecret) {
    req.logger.verbose(
      `User ${userId} tried enabling MFA but the OTP secret was not set ${otpSecret}`,
      {
        userId,
        otpSecret,
      }
    );
    return res.boom.badRequest("OTP secret is not set");
  }

  if (!authenticator.check(code, otpSecret)) {
    return res.boom.unauthorized("Invalid two-factor code");
  }

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      mfaEnabled: true,
    },
  });

  req.logger.verbose(`User ${userId} enabled MFA`, {
    userId,
  });

  return res.status(204).send();
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: MfaSchema;
}

export default (router: Router) => {
  router.post(
    "/enable",
    createValidator().body(mfaSchema),
    asyncWrapper(enableMfa)
  );
};
