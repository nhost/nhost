import { Response } from "express";
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from "express-joi-validation";

import { gqlSdk } from "@/utils/gqlSDK";
import { getSignInTokens } from "@/utils/tokens";

type BodyType = {
  ticket: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInMagicLinkCallbackHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log("sign up magic link callback handler");

  const { ticket } = req.body;

  const user = await gqlSdk
    .getUserByTicket({
      ticket,
    })
    .then((res) => res.users[0]);

  if (!user.isActive) {
    throw new Error("User is not active");
  }

  const updatedUser = await gqlSdk
    .updateUsersByTicket({
      ticket,
      user: {
        emailVerified: true,
        ticket: null,
      },
    })
    .then((res) => res.updateUsers);

  if (!updatedUser || updatedUser.affected_rows === 0) {
    return res.status(401).send("Invalid or expired ticket");
  }

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: true,
  });

  // login user
  return res.send(signInTokens);
};
