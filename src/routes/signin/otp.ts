import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import Joi from 'joi';
import bcrypt from 'bcryptjs';

import { gqlSdk } from '@/utils/gqlSDK';
import { getSignInTokens } from '@/utils/tokens';
import { getUserByTicket } from '@/helpers';
import { authenticator } from 'otplib';

export const signInOtpSchema = Joi.object({
  signInMethod: Joi.string()
    .valid('magic-link', 'phone-number', 'mfa-sms', 'mfa-totp')
    .required(),
  identifier: Joi.string().required(),
  otpParam: Joi.string().required(),
});

type BodyType = {
  otpMethod: 'magic-link' | 'phone-number' | 'mfa-totp' | 'mfa-sms';
  identifier: string; // value of email, phoneNumber or ticket
  otp: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInOtpHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { otpMethod, identifier, otp } = req.body;

  let userId;

  if (otpMethod === 'magic-link') {
    const email = identifier;

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

    // set user id
    userId = user.id;
  } else if (otpMethod === 'phone-number') {
    const phoneNumber = identifier;

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

    // set user id
    userId = user.id;
  } else if (otpMethod === 'mfa-sms') {
    const ticket = identifier;
    const user = await getUserByTicket(ticket);

    if (!user || !user.otpHash) {
      return res.boom.unauthorized('Invalid or expired OTP');
    }

    if (!(await bcrypt.compare(otp, user.otpHash))) {
      return res.boom.unauthorized('Invalid or expired OTP');
    }

    // set user id
    userId = user.id;
  } else if (otpMethod === 'mfa-totp') {
    const ticket = identifier;
    const user = await getUserByTicket(ticket);

    if (!user) {
      return res.boom.unauthorized('Invalid code');
    }

    if (!user.isActive) {
      return res.boom.badRequest('User is not activated');
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

    // set user id
    userId = user.id;
  } else {
    throw new Error('Incorrect otpMethod');
  }

  const isMfaRequest = otpMethod.startsWith('mfa-');

  const signInTokens = await getSignInTokens({
    userId,
    checkMFA: !isMfaRequest,
  });

  // login user
  return res.send(signInTokens);
};
