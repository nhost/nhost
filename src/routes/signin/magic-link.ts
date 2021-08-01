import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { v4 as uuidv4 } from 'uuid';

import { REGISTRATION } from '@config/registration';
import { getGravatarUrl, getUserByEmail, isWhitelistedEmail } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { APPLICATION } from '@config/application';
import { emailClient } from '@/email';
import { insertProfile } from '@/utils/profile';
import { AUTHENTICATION } from '@config/authentication';

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
  console.log('sign up magic link handler');

  if (!AUTHENTICATION.MAGIC_LINK_ENABLED) {
    return res.boom.notFound('Magic link is not enabled');
  }

  // EMAIL must be enabled
  if (!APPLICATION.EMAILS_ENABLED) {
    throw new Error('SMTP settings unavailable');
  }

  const { body } = req;
  const { email, profile, locale } = body;

  // check if email already exist
  const user = await getUserByEmail(email);

  let userId = user ? user.id : undefined;

  if (!user) {
    // create user is user not already exists

    // Check if whitelisting is enabled and if email is whitelisted
    if (REGISTRATION.WHITELIST && !(await isWhitelistedEmail(email))) {
      return res.boom.unauthorized('Email not allowed');
    }

    // set default role
    const defaultRole = body.defaultRole ?? REGISTRATION.DEFAULT_USER_ROLE;

    // set allowed roles
    const allowedRoles =
      body.allowedRoles ?? REGISTRATION.DEFAULT_ALLOWED_USER_ROLES;

    // check if default role is part of allowedRoles
    if (!allowedRoles.includes(defaultRole)) {
      return res.boom.badRequest('Default role must be part of allowed roles');
    }

    console.log('check allowed roles subset');

    console.log(allowedRoles);
    console.log(REGISTRATION.DEFAULT_ALLOWED_USER_ROLES);

    // check if allowedRoles is a subset of allowed user roles
    if (
      !allowedRoles.every((role: string) =>
        REGISTRATION.ALLOWED_USER_ROLES.includes(role)
      )
    ) {
      console.error('allowed roles is not a subset');

      return res.boom.badRequest(
        'Allowed roles must be a subset of allowedRoles'
      );
    }

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
          displayName,
          avatarUrl,
          email,
          passwordHash: null,
          isActive: true,
          emailVerified: false,
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

  // send magic link

  // Ticket
  const ticket = `magicLink:${uuidv4()}`;
  const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000).toISOString();

  gqlSdk.updateUser({
    id: userId,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  // user is now inserted. Continue sending out activation email
  await emailClient.send({
    template: 'magic-link',
    message: {
      to: email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket,
        },
      },
    },
    locals: {
      email,
      locale,
      token: ticket,
      url: APPLICATION.SERVER_URL,
      appUrl: APPLICATION.APP_URL,
    },
  });

  res.status(200).send('OK');
};
