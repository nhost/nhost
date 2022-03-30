import { RequestHandler } from 'express';

import { getSignInResponse, getUserByTicket } from '@/utils';
import { authenticator } from 'otplib';
import { sendError } from '@/errors';
import { Joi, mfaTotpTicketPattern } from '@/validation';

export const signInMfaTotpSchema = Joi.object({
  ticket: Joi.string()
    .regex(mfaTotpTicketPattern)
    .required()
    .example('mfaTotp:e08204c7-40af-4434-a7ed-31c6aa37a390'),
  otp: Joi.string().required(),
}).meta({ className: 'SignInMfaTotpSchema' });

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
