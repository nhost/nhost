import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';

import { getSignInResponse, gqlSdk } from '@/utils';
import { OtpSmsBody } from '@/types';
import { sendError } from '@/errors';
import { Joi } from '@/validation';

export const signInOtpSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  otp: Joi.string().required(),
}).meta({ className: 'SignInOtpSchema' });

export const signInOtpHandler: RequestHandler<{}, {}, OtpSmsBody> = async (
  req,
  res
) => {
  const { body } = req;

  const { phoneNumber, otp } = body;

  const user = await gqlSdk
    .users({
      where: {
        _and: [
          {
            phoneNumber: {
              _eq: phoneNumber,
            },
          },
          {
            otpMethodLastUsed: {
              _eq: 'sms',
            },
          },
          {
            otpHashExpiresAt: {
              _gt: new Date(),
            },
          },
        ],
      },
    })
    .then((gqlres) => gqlres.users[0]);

  if (!user) {
    return sendError(res, 'invalid-otp');
  }

  // continue checking the user
  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (!user || !user.otpHash) {
    return sendError(res, 'invalid-otp');
  }

  if (!(await bcrypt.compare(otp, user.otpHash))) {
    return sendError(res, 'invalid-otp');
  }

  // verify phone number
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      otpHash: null,
      phoneNumberVerified: true,
    },
  });

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: true,
  });

  return res.send(signInResponse);
};
