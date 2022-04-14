import { RequestHandler } from 'express';
import twilio from 'twilio';
import { ReasonPhrases } from 'http-status-codes';

import { PasswordLessSmsBody } from '@/types';
import {
  gqlSdk,
  getNewOneTimePasswordData,
  getUserByPhoneNumber,
  insertUser,
  ENV,
} from '@/utils';
import { sendError } from '@/errors';
import { Joi, registrationOptions } from '@/validation';

export const signInPasswordlessSmsSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  options: registrationOptions,
}).meta({ className: 'SignInPasswordlessSmsSchema' });

export const signInPasswordlessSmsHandler: RequestHandler<
  {},
  {},
  PasswordLessSmsBody
> = async (req, res) => {
  if (!ENV.AUTH_SMS_PASSWORDLESS_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const {
    phoneNumber,
    options: { defaultRole, allowedRoles, displayName, locale, metadata },
  } = req.body;

  // check if email already exist
  let user = await getUserByPhoneNumber({ phoneNumber });

  // if no user exists, create the user
  if (!user) {
    user = await insertUser({
      disabled: ENV.AUTH_DISABLE_NEW_USERS,
      displayName,
      avatarUrl: '',
      phoneNumber,
      locale,
      defaultRole,
      roles: {
        // restructure user roles to be inserted in GraphQL mutation
        data: allowedRoles.map((role: string) => ({ role })),
      },
      metadata,
    });
  }

  // set otp for user that will be sent in the email
  const { otp, otpHash, otpHashExpiresAt } = await getNewOneTimePasswordData();

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      otpMethodLastUsed: 'sms',
      otpHash,
      otpHashExpiresAt,
    },
  });

  if (ENV.AUTH_SMS_PROVIDER === 'twilio') {
    const twilioClient = twilio(
      ENV.AUTH_SMS_TWILIO_ACCOUNT_SID,
      ENV.AUTH_SMS_TWILIO_AUTH_TOKEN
    );

    try {
      await twilioClient.messages.create({
        body: `Your code is ${otp}`,
        messagingServiceSid: ENV.AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID,
        to: phoneNumber,
      });
    } catch (error) {
      // delete user that was inserted because we were not able to send the SMS
      await gqlSdk.deleteUser({
        userId: user.id,
      });

      throw Error('Error sending SMS');
    }
  } else {
    throw Error('No sms provider set');
  }

  return res.send(ReasonPhrases.OK);
};
