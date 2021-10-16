import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import bcrypt from 'bcryptjs';

import { getSignInResponse } from '@/utils/tokens';
import { gqlSdk } from '@/utils/gqlSDK';
import { OtpSmsBody } from '@/types';

type BodyType = OtpSmsBody;

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInOtpHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
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
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  // continue checking the user
  if (user.disabled) {
    return res.boom.badRequest('User is disabled');
  }

  if (!user || !user.otpHash) {
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  if (!(await bcrypt.compare(otp, user.otpHash))) {
    return res.boom.unauthorized('Invalid or expired OTP');
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
