import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';

import { getSignInResponse, getUserByTicket } from '@/utils';
import { sendError } from '@/errors';

export const signInMfaSmspHandler: RequestHandler<
  {},
  {},
  {
    ticket: string;
    otp: string;
  }
> = async (req, res) => {
  const { ticket, otp } = req.body;

  const user = await getUserByTicket(ticket);

  if (!user || !user.otpHash) {
    return sendError(res, 'invalid-otp');
  }

  if (!(await bcrypt.compare(otp, user.otpHash))) {
    return sendError(res, 'invalid-otp');
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
