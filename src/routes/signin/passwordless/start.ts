import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getGravatarUrl, getUserByEmail } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { emailClient } from '@/email';
import { insertProfile, isProfileValid } from '@/utils/profile';
import { ENV } from '@/utils/env';
import { isValidEmail } from '@/utils/email';
import { isRolesValid } from '@/utils/roles';
import { getNewOneTimePasswordData } from '@/utils/otp';
import { PasswordLessEmailBody, PasswordLessSmsBody } from '@/types';

type BodyType = PasswordLessEmailBody | PasswordLessSmsBody;

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInPasswordlessStartHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { body } = req;

  if (body.connection === 'email') {
    if (!ENV.PASSWORDLESS_EMAIL_ENABLED) {
      return res.boom.notFound(
        'Passwordless sign in with email is not enabled'
      );
    }

    if (!ENV.EMAILS_ENABLED) {
      return res.boom.internal('SMTP settings unavailable');
    }

    const { email, profile, locale = ENV.DEFAULT_LOCALE } = body;

    // check if email already exist
    let user = await getUserByEmail(email);

    let userId = user ? user.id : undefined;

    // if no user exists, create the user
    if (!user) {
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

      // create new user
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

      user = insertedUser;
      userId = insertedUser.id;
    }

    // set otp for user that will be sent in the email
    const { otp, otpHash, otpHashExpiresAt } =
      await getNewOneTimePasswordData();

    await gqlSdk.updateUser({
      id: userId,
      user: {
        otpMethodLastUsed: 'email',
        otpHash,
        otpHashExpiresAt,
      },
    });

    await emailClient.send({
      template: 'passwordless',
      message: {
        to: email,
        headers: {
          'x-email': {
            prepared: true,
            value: email,
          },
          'x-otp': {
            prepared: true,
            value: otp,
          },
          'x-email-template': {
            prepared: true,
            value: 'passwordless',
          },
        },
      },
      locals: {
        displayName: user.displayName,
        email,
        otp,
        locale: user.locale,
        url: ENV.SERVER_URL,
        appUrl: ENV.APP_URL,
      },
    });
  } else if (body.connection === 'sms') {
    // TODO
    return res.boom.notImplemented(
      'Passwordless connection is not implemented yet.'
    );
  }

  return res.send('ok');
};
