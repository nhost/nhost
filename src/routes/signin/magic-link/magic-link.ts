import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getGravatarUrl, getUserByEmail } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { APPLICATION } from '@config/application';
import { emailClient } from '@/email';
import { insertProfile, isProfileValid } from '@/utils/profile';
import { ENV } from '@/utils/env';
import { isValidEmail } from '@/utils/email';
import { isRolesValid } from '@/utils/roles';
import { getOtpData } from '@/utils/otp';

type Profile = {
  [key: string]: string | number | boolean;
};

type BodyType = {
  email: string;
  password: string;
  locale: string;
  allowedRoles: string[];
  defaultRole: string;
  displayName: string;
  profile: Profile | null;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInMagicLinkHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.MAGIC_LINK_ENABLED) {
    return res.boom.notFound('Magic link is not enabled');
  }

  // EMAIL must be enabled
  if (!APPLICATION.EMAILS_ENABLED) {
    throw new Error('SMTP settings unavailable');
  }

  const { body } = req;
  const { email, profile, locale = ENV.DEFAULT_LOCALE } = body;

  // check if email already exist
  const user = await getUserByEmail(email);

  let userId = user ? user.id : undefined;

  if (!user) {
    // create user is user not already exists

    // check email
    if (!(await isValidEmail({ email, res }))) {
      // function send potential error via `res`
      return;
    }

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

    const displayName = body.displayName ?? email;
    const avatarUrl = getGravatarUrl(email);

    // insert user
    // alawys set user as active = true here
    // we then check the `isActive` value in the callback to make sure the user
    // is still active.
    const insertedUser = await gqlSdk
      .insertUser({
        user: {
          disabled: ENV.DISABLE_NEW_USERS,
          displayName,
          avatarUrl,
          email,
          locale,
          defaultRole,
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

  // OTP
  const { otp, otpHash, otpHashExpiresAt } = await getOtpData();

  gqlSdk.updateUser({
    id: userId,
    user: {
      otpHash,
      otpHashExpiresAt,
    },
  });

  // Send magic link
  await emailClient.send({
    template: 'magic-link',
    message: {
      to: email,
      headers: {
        'x-otp': {
          prepared: true,
          value: otp,
        },
        'x-email-template': {
          prepared: true,
          value: 'magic-link',
        },
      },
    },
    locals: {
      email,
      locale,
      otp,
      url: APPLICATION.SERVER_URL,
      appUrl: APPLICATION.APP_URL,
    },
  });

  res.status(200).send('OK');
};
