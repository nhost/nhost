import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import bcrypt from 'bcryptjs';

import { getSignInResponse } from '@/utils/tokens';
import { gqlSdk } from '@/utils/gqlSDK';
import { OtpEmailBody, OtpSmsBody } from '@/types';

type BodyType = OtpEmailBody | OtpSmsBody;

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInOtpHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { otp } = req.body;

  const { body } = req;

  let user;

  if (body.connection === 'sms') {
    const { phoneNumber } = body;

    user = await gqlSdk
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
  } else if (body.connection === 'email') {
    const { email } = body;

    user = await gqlSdk
      .users({
        where: {
          _and: [
            {
              email: {
                _eq: email,
              },
            },
            {
              otpMethodLastUsed: {
                _eq: 'email',
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
  } else {
    return res.boom.badRequest('Incorrect mode');
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

  // verify the method (mode)
  if (body.connection === 'sms') {
    // verify phone number
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        otpHash: null,
        phoneNumberVerified: true,
      },
    });
  } else if (body.connection === 'email') {
    // verify email
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        otpHash: null,
        emailVerified: true,
      },
    });
  } else {
    // should never be able to happen
    return res.boom.badRequest('Incorrect mode');
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: true,
  });

  return res.send(signInResponse);
};
