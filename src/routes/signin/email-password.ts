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
import { logger } from '@/logger';
import { isValidEmail } from '@/utils/email';

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
  logger.debug(`Sign in with email: ${email}`);

  // check email
  if (!(await isValidEmail({ email, res }))) {
    // function send potential error via `res`
    return;
  }

  const user = await getUserByEmail(email);

  if (!user) {
    logger.debug('No user with that email exist');
    return res.boom.unauthorized('Incorrect email or password');
  }

  if (user.disabled) {
    logger.debug('User is disabled');
    return res.boom.unauthorized('User is disabled');
  }

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    logger.debug('Email is not verified');
    return res.boom.unauthorized('Email is not verified');
  }

  if (!user.passwordHash) {
    logger.debug('User has no password set');
    // TODO correct error message
    return res.boom.unauthorized('Incorrect email or password');
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordCorrect) {
    logger.debug('Incorrect password');
    return res.boom.unauthorized('Incorrect email or password');
  }

  const signInTokens = await getSignInResponse({
    userId: user.id,
    checkMFA: true,
  });

  return res.send(signInTokens);
};
