import { RequestHandler } from 'express';

import { getSignInResponse } from '@/utils/tokens';
import { getUserByTicket } from '@/helpers';
import { authenticator } from 'otplib';

export const signInMfaTotpHandler: RequestHandler<
  {},
  {},
  {
    ticket: string;
    otp: string;
  }
> = async (req, res) => {
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

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
