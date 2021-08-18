import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import bcrypt from 'bcryptjs';

import { getSignInResponse } from '@/utils/tokens';
import { getUserByEmail } from '@/helpers';
import { ENV } from '@/utils/env';

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
  const { email, password } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    return res.boom.unauthorized('No user with that email');
  }

  if (user.disabled) {
    return res.boom.unauthorized('User is disabled');
  }

  if (ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return res.boom.unauthorized('Email is not verified');
  }

  if (!user.passwordHash) {
    return res.boom.unauthorized('User has no password set');
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordCorrect) {
    return res.boom.unauthorized('Incorrect password');
  }

  const signInTokens = await getSignInResponse({
    userId: user.id,
    checkMFA: true,
  });

  // login user
  return res.send(signInTokens);
};
