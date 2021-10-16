import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { gqlSdk } from '../gqlSDK';
import { isValidEmail } from '../email';
import { getUserByEmail, hashPassword, isValidRedirectTo } from '@/helpers';
import { isPasswordValid } from '../password';
import { isRolesValid } from '../roles';
import { ENV } from '../env';
import { emailClient } from '@/email';
import { generateTicketExpiresAt } from '../ticket';

export type BodyTypeEmailPassword = {
  signInMethod: 'email-password';
  email: string;
  password: string;
  options: {
    allowedRoles?: string[];
    defaultRole?: string;
    redirectTo?: string;
  };
};

export const handleDeanonymizeUserEmailPassword = async (
  body: BodyTypeEmailPassword,
  userId: string,
  res: Response
): Promise<unknown> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (user?.isAnonymous !== true) {
    return res.boom.badRequest('Logged in user is not anonymous');
  }

  const { email, password, options } = body;

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo({ redirectTo })) {
    return res.boom.badRequest(`'redirectTo' is not allowed`);
  }

  // check email
  if (!(await isValidEmail({ email, res }))) {
    // function send potential error via `res`
    return;
  }

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return res.boom.conflict('Email already in use');
  }

  // check password
  if (!(await isPasswordValid({ password, res }))) {
    // function send potential error via `res`
    return;
  }

  const passwordHash = await hashPassword(password);

  // check roles
  const defaultRole = options?.defaultRole ?? ENV.AUTH_DEFAULT_USER_ROLE;
  const allowedRoles =
    options?.allowedRoles ?? ENV.AUTH_DEFAULT_ALLOWED_USER_ROLES;
  if (!(await isRolesValid({ defaultRole, allowedRoles, res }))) {
    return;
  }

  const userRoles = allowedRoles.map((role: string) => ({ role, userId }));

  // delete existing (anonymous) user roles
  await gqlSdk.deleteUserRolesByUserId({
    userId,
  });

  // insert new user roles (userRoles)
  await gqlSdk.insertUserRoles({
    userRoles,
  });

  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  await gqlSdk.updateUser({
    id: userId,
    user: {
      emailVerified: false,
      email,
      passwordHash,
      defaultRole,
      ticket,
      ticketExpiresAt,
      isAnonymous: false,
    },
  });

  // delete old refresh tokens if user must verify their email before they can
  // sign in.
  if (ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    await gqlSdk.deleteUserRefreshTokens({
      userId,
    });
  }

  if (!ENV.AUTH_DISABLE_NEW_USERS && ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    if (!ENV.AUTH_EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable');
    }

    const template = 'email-verify';
    await emailClient.send({
      template,
      message: {
        to: email,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket as string,
          },
          'x-redirect-to': {
            prepared: true,
            value: redirectTo,
          },
          'x-email-template': {
            prepared: true,
            value: template,
          },
        },
      },
      locals: {
        displayName: user.displayName,
        email,
        ticket,
        redirectTo,
        locale: user.locale,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }

  res.send('ok');
};
