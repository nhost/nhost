import { gqlSdk } from "@/utils/gqlSDK";
import { Response } from "express";
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from "express-joi-validation";
import { authenticator } from "otplib";

type BodyType = {
  code: string;
  mfaEnabled: boolean;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userMFAHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send("Incorrect access token");
  }

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error("user could not be fetched");
  }

  if (!user.otpSecret) {
    return res.boom.internal("otp secret is not set for user");
  }

  const { code, mfaEnabled } = req.body;

  if (!authenticator.check(code, user.otpSecret)) {
    return res.boom.unauthorized("Invalid code");
  }

  await gqlSdk.updateUser({
    id: userId,
    user: {
      mfaEnabled,
    },
  });

  return res.send("OK");
};
