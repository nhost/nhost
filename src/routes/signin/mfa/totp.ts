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
  otp: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInMfaTotpHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { ticket, otp } = req.body;

  const user = await getUserByTicket(ticket);

  if (!user) {
    return res.boom.unauthorized('Invalid code');
  }

  if (user.disabled) {
    return res.boom.badRequest('User is disabled');
  }

  if (user.activeMfaType !== 'totp') {
    return res.boom.badRequest('MFA TOTP is not enabled for this user');
  }

  if (!user.totpSecret) {
    return res.boom.badRequest('OTP secret is not set for user');
  }

  authenticator.options = {
    window: 1,
  };

  if (!authenticator.check(otp, user.totpSecret)) {
    return res.boom.unauthorized('Invalid code');
  }

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInTokens);
};
