import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getSignInTokens } from '@/utils/tokens';
import { getUserByTicket } from '@/helpers';
import { authenticator } from 'otplib';

type BodyType = {
  ticket: string;
  code: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInMFATOTOPHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('sign up mfa totp handler');

  const { ticket, code } = req.body;

  const user = await getUserByTicket(ticket);

  if (!user) {
    throw new Error('Invalid or expired ticket');
  }

  if (!user.mfaEnabled) {
    return res.boom.badRequest('MFA is not enabled for this user');
  }

  if (!user.isActive) {
    return res.boom.badRequest('User is not activated');
  }

  if (!user.otpSecret) {
    return res.boom.badRequest('OTP secret is not set for user');
  }

  // enable past and post (+- 30 seconds) to be valid too
  authenticator.options = {
    window: 1,
  };
  if (!authenticator.check(code, user.otpSecret)) {
    return res.boom.unauthorized('Invalid code');
  }

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInTokens);
};
