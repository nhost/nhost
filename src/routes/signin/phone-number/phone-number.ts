import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { v4 as uuidv4 } from 'uuid';

import { getGravatarUrl, getUserByEmail, hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { APPLICATION } from '@config/application';
import { emailClient } from '@/email';
import { insertProfile, isProfileValid } from '@/utils/profile';
import { AUTHENTICATION } from '@config/authentication';
import { ENV } from '@/utils/env';
import { isValidEmail } from '@/utils/email';
import { isRolesValid } from '@/utils/roles';
import { getUserByPhoneNumber } from '@/utils/user';
import { generateTicketExpiresAt } from '@/utils/ticket';

type Profile = {
  [key: string]: string | number | boolean;
};

type BodyType = {
  phoneNumber: string;
  locale: string;
  allowedRoles: string[];
  defaultRole: string;
  displayName: string;
  profile: Profile | null;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInSmsHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.PHONE_NUMBER_AUTH_ENABLED) {
    return res.boom.notFound('Phone number sign in is not enabled');
  }

  const { body } = req;
  const { phoneNumber, profile, locale = ENV.DEFAULT_LOCALE } = body;

  // check if email already exist
  const user = await getUserByPhoneNumber({ phoneNumber });

  let userId = user ? user.id : undefined;

  if (!user) {
    // create user is user not already exists

    // check phone number
    // TODO: Check valid phone number

    // check profile
    if (!(await isProfileValid({ profile, res }))) {
      // function send potential error via `res`
      return;
    }

    // check roles
    const defaultRole = body.defaultRole ?? ENV.DEFAULT_USER_ROLE;
    const allowedRoles = body.allowedRoles ?? ENV.DEFAULT_ALLOWED_USER_ROLES;
    if (!(await isRolesValid({ defaultRole, allowedRoles, res }))) {
      return;
    }

    // set default role

    // restructure user roles to be inserted in GraphQL mutation
    const userRoles = allowedRoles.map((role: string) => ({ role }));

    const displayName = body.displayName;

    // insert user
    // alawys set user as active = true here
    // we then check the `isActive` value in the callback to make sure the user
    // is still active.
    const insertedUser = await gqlSdk
      .insertUser({
        user: {
          disabled: ENV.DISABLE_NEW_USERS,
          displayName,
          phoneNumber,
          locale,
          defaultRole,
          lastVerifyPhoneNumberSentAt: new Date(),
          roles: {
            data: userRoles,
          },
        },
      })
      .then((res) => res.insertUser);

    if (!insertedUser) {
      throw new Error('Unable to insert new user');
    }

    await insertProfile({ userId: insertedUser.id, profile });

    userId = insertedUser.id;
  }

  // generate OTP
  const otp = '123456';
  const otpHash = await hashPassword(otp);
  const otpHashExpiresAt = generateTicketExpiresAt(5 * 60);

  gqlSdk.updateUser({
    id: userId,
    user: {
      otpHash,
      otpHashExpiresAt,
    },
  });

  // send sms to `phoneNumber` with `otp`

  res.status(200).send('OK');
};
