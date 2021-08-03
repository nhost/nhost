import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import bcrypt from 'bcryptjs';

import { getSignInTokens } from '@/utils/tokens';
import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  phoneNumber: string;
  otp: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInPhoneNumberOtpHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { phoneNumber, otp } = req.body;

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
            otpHashExpiresAt: {
              _gt: new Date(),
            },
          },
        ],
      },
    })
    .then((gqlres) => gqlres.users[0]);

  if (!user.isActive) {
    return res.boom.badRequest('User is not activated');
  }

  if (!user || !user.otpHash) {
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  if (!(await bcrypt.compare(otp, user.otpHash))) {
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      phoneNumberVerified: true,
    },
  });

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInTokens);
};
