import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';

import { ENV, getSignInResponse, gqlSdk } from '@/utils';
import { OtpSmsBody } from '@/types';
import { sendError } from '@/errors';
import { Joi } from '@/validation';
import { isVerifySid } from '@/utils/twilio';
import twilio from 'twilio';

export const signInOtpSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  otp: Joi.string().required(),
}).meta({ className: 'SignInOtpSchema' });

export const signInOtpHandler: RequestHandler<{}, {}, OtpSmsBody> = async (
  req,
  res
) => {
  if (!ENV.AUTH_SMS_PASSWORDLESS_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

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

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (!user || !user.otpHash) {
    return sendError(res, 'invalid-otp');
  }

  if (!ENV.AUTH_SMS_PROVIDER) {
    throw Error('No sms provider set');
  }

  const messagingServiceSid = ENV.AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID;

  if (isVerifySid(messagingServiceSid)) {
    const twilioClient = twilio(
      ENV.AUTH_SMS_TWILIO_ACCOUNT_SID,
      ENV.AUTH_SMS_TWILIO_AUTH_TOKEN
    );

    try {
      const verificationCheck = await twilioClient.verify
        .services(messagingServiceSid)
        .verificationChecks.create({
          code: otp,
          to: user.phoneNumber ?? '',
        });

      if (!verificationCheck.valid || verificationCheck.status !== 'approved') {
        return sendError(res, 'invalid-otp');
      }
    } catch (error) {
      throw Error('Cannot veirfy otp');
    }
  } else if (!(await bcrypt.compare(otp, user.otpHash))) {
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
