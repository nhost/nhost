import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';

import { getSignInResponse } from '@/utils/tokens';
import { getUserByTicket } from '@/helpers';

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
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  if (!(await bcrypt.compare(otp, user.otpHash))) {
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
