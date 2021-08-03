import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import bcrypt from 'bcryptjs';

import { gqlSdk } from '@/utils/gqlSDK';
import { getSignInTokens } from '@/utils/tokens';
import { ENV } from '@/utils/env';

type BodyType = {
  email: string;
  otp: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInMagicLinkOtpHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.MAGIC_LINK_ENABLED) {
    return res.boom.notFound('Magic link is not enabled');
  }

  const { email, otp } = req.body;

  const user = await gqlSdk
    .users({
      where: {
        _and: [
          {
            email: {
              _eq: email,
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

  if (!user || !user.otpHash) {
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  if (!user.isActive) {
    return res.boom.badRequest('User is not activated');
  }

  if (!(await bcrypt.compare(otp, user.otpHash))) {
    return res.boom.unauthorized('Invalid or expired OTP');
  }

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      emailVerified: true,
    },
  });

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: true,
  });

  // login user
  return res.send(signInTokens);
};
