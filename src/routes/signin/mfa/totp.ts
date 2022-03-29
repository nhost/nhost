import { RequestHandler } from 'express';

import { getSignInResponse } from '@/utils/tokens';
import { getUserByTicket } from '@/helpers';
import { authenticator } from 'otplib';
import { sendError } from '@/errors';

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
    return sendError(res, 'invalid-otp');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (user.activeMfaType !== 'totp') {
    return sendError(res, 'disabled-mfa-totp');
  }

  if (!user.totpSecret) {
    return sendError(res, 'no-totp-secret');
  }

  authenticator.options = {
    window: 1,
  };

  if (!authenticator.check(otp, user.totpSecret)) {
    return sendError(res, 'invalid-otp');
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
