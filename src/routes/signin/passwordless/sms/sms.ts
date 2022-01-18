import { Response } from 'express';
import twilio from 'twilio';

import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';
import { isRolesValid } from '@/utils/roles';
import { getNewOneTimePasswordData } from '@/utils/otp';
import { PasswordLessSmsBody } from '@/types';
import { getUserByPhoneNumber } from '@/utils/user';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: PasswordLessSmsBody;
}

export const signInPasswordlessSmsHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.AUTH_SMS_PASSWORDLESS_ENABLED) {
    return res.boom.notFound('Passwordless sign in with sms is not enabled');
  }

  const { phoneNumber, options } = req.body;

  // check if email already exist
  let user = await getUserByPhoneNumber({ phoneNumber });

  let userId = user ? user.id : undefined;

  // if no user exists, create the user
  if (!user) {
    // check roles
    const defaultRole = options?.defaultRole ?? ENV.AUTH_USER_DEFAULT_ROLE;
    const allowedRoles =
      options?.allowedRoles ?? ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES;
    if (!(await isRolesValid({ defaultRole, allowedRoles, res }))) {
      return;
    }

    // set default role

    // restructure user roles to be inserted in GraphQL mutation
    const userRoles = allowedRoles.map((role: string) => ({ role }));

    const displayName = options?.displayName ?? '';
    const locale = options?.locale ?? ENV.AUTH_LOCALE_DEFAULT;
    const avatarUrl = '';

    // create new user
    const insertedUser = await gqlSdk
      .insertUser({
        user: {
          disabled: ENV.AUTH_DISABLE_NEW_USERS,
          displayName,
          avatarUrl,
          phoneNumber,
          locale,
          defaultRole,
          roles: {
            data: userRoles,
          },
        },
      })
      .then((response) => response.insertUser);

    if (!insertedUser) {
      throw new Error('Unable to insert new user');
    }

    user = insertedUser;
    userId = insertedUser.id;
  }

  // set otp for user that will be sent in the email
  const { otp, otpHash, otpHashExpiresAt } = await getNewOneTimePasswordData();

  await gqlSdk.updateUser({
    id: userId,
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
        userId,
      });

      return res.boom.internal('Error sending SMS');
    }
  } else {
    return res.boom.internal('no sms provider set');
  }

  return res.send('ok');
};
