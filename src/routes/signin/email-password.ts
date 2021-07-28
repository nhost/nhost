import { Response } from "express";
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from "express-joi-validation";
import bcrypt from "bcryptjs";

import { getSignInTokens } from "@/utils/tokens";
import { getUserByEmail } from "@/helpers";

type Profile = {
  [key: string]: string | number | boolean;
};

type BodyType = {
  email: string;
  password: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInEmailPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log("sign up magic link callback handler");

  const { email, password } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("No user with that email");
  }

  if (!user.isActive) {
    throw new Error("User is not active");
  }

  if (!user.passwordHash) {
    throw new Error("No password hash");
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordCorrect) {
    throw new Error("Incorrect password");
  }

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: true,
  });

  // login user
  return res.send(signInTokens);
};
