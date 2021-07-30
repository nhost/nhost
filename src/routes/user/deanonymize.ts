import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { pwnedPassword } from 'hibp';
import { v4 as uuidv4 } from 'uuid';

import { getUserByEmail, hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { REGISTRATION } from '@config/registration';
import { emailClient } from '@/email';
import { APPLICATION } from '@config/application';
import { AUTHENTICATION } from '@config/authentication';

type BodyType = {
  signInMethod: 'email-password' | 'magic-link';
  email: string;
  password?: string;
  allowedRoles: string[];
  defaultRole: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userDeanonymizeHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send('Incorrect access token');
  }

  const { signInMethod, email, password, defaultRole } = req.body;

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  console.log({ user });

  // we don't use the `isAnonymous` from the middeware because it might be out
  // dated if you make this request multiple times in a short amount of time
  if (user?.isAnonymous !== true) {
    return res.boom.badRequest('Logged in user is not anonymous');
  }

  const userAlreadyExist = await getUserByEmail(email);

  // check if email is already in use by some other user
  if (userAlreadyExist) {
    return res.boom.badRequest('Email already in use');
  }

  // checks for email-password sign in method
  if (signInMethod === 'email-password') {
    if (!password) {
      return res.boom.badRequest('missing password');
    }

    if (REGISTRATION.HIBP_ENABLED && (await pwnedPassword(password))) {
      return res.boom.badRequest('Password is too weak');
    }
  }

  const allowedRoles =
    req.body.allowedRoles ?? REGISTRATION.DEFAULT_ALLOWED_USER_ROLES;

  // check if default role is part of allowedRoles
  if (!allowedRoles.includes(defaultRole)) {
    return res.boom.badRequest('Default role must be part of allowed roles');
  }

  // check if allowedRoles is a subset of allowed user roles
  if (
    !allowedRoles.every((role: string) =>
      REGISTRATION.ALLOWED_USER_ROLES.includes(role)
    )
  ) {
    return res.boom.badRequest(
      'Allowed roles must be a subset of allowedRoles'
    );
  }

  // password is null if password is not set
  // if password is null we're using sign in method magic link
  const passwordHash = password ? await hashPassword(password) : null;

  const userRoles = allowedRoles.map((role: string) => ({ role, userId }));

  //
  const ticketPrefix =
    signInMethod === 'email-password' ? 'userActivate' : 'magicLink';
  const ticket = `${ticketPrefix}:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  // set isActive to true directly if users should be automatically activated
  // if AUTO_ACTIVATED_NEW_USER is false the user must instead activate their
  // account with the email
  const isActive =
    signInMethod === 'magic-link'
      ? true
      : signInMethod === 'email-password'
      ? REGISTRATION.AUTO_ACTIVATE_NEW_USERS
      : false;

  await gqlSdk.updateUser({
    id: userId,
    user: {
      isActive,
      emailVerified: false,
      email,
      passwordHash,
      defaultRole,
      ticket,
      ticketExpiresAt,
      isAnonymous: false,
    },
  });

  if (!user) {
    throw new Error('Unable to get user');
  }

  // delete existing (anonymous) user roles
  await gqlSdk.deleteUserRolesByUserId({
    userId,
  });

  // insert new user roles (userRoles)
  await gqlSdk.insertUserRoles({
    userRoles,
  });

  // send email
  if (signInMethod === 'email-password') {
    console.log('login method email password');

    console.log('auto activate new users');
    console.log(REGISTRATION.AUTO_ACTIVATE_NEW_USERS);

    console.log('verify emails');
    console.log(AUTHENTICATION.VERIFY_EMAILS);

    if (!REGISTRATION.AUTO_ACTIVATE_NEW_USERS && AUTHENTICATION.VERIFY_EMAILS) {
      console.log('send email');
      if (!APPLICATION.EMAILS_ENABLED) {
        throw new Error('SMTP settings unavailable');
      }

      await emailClient.send({
        template: 'activate-user',
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
          displayName: user.displayName,
          ticket,
          url: APPLICATION.SERVER_URL,
          locale: user.locale,
        },
      });
    }
  } else if (signInMethod === 'magic-link') {
    console.log('login method magic link');
    if (!APPLICATION.EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable');
    }

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
        locale: user.locale,
        token: ticket,
        url: APPLICATION.SERVER_URL,
        appUrl: APPLICATION.APP_URL,
      },
    });
  } else {
    throw new Error('Invalid state');
  }

  return res.send('OK');
};
