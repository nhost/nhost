import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { gqlSdk } from '../gqlSDK';
import { isValidEmail } from '../email';
import { getUserByEmail, isValidRedirectTo } from '@/helpers';
import { isRolesValid } from '../roles';
import { ENV } from '../env';
import { emailClient } from '@/email';
import { generateTicketExpiresAt } from '../ticket';

export type BodyTypePasswordlessEmail = {
  signInMethod: 'passwordless';
  connection: 'email';
  email: string;
  options: {
    allowedRoles?: string[];
    defaultRole?: string;
    redirectTo?: string;
  };
};

export const handleDeanonymizeUserPasswordlessEmail = async (
  body: BodyTypePasswordlessEmail,
  userId: string,
  res: Response
): Promise<unknown> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (user?.isAnonymous !== true) {
    return res.boom.badRequest('Logged in user is not anonymous');
  }

  const { email, options } = body;

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo({ redirectTo })) {
    return res.boom.badRequest(`'redirectTo' is not valid`);
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

  // check roles
  const defaultRole = options?.defaultRole ?? ENV.AUTH_USER_DEFAULT_ROLE;
  const allowedRoles =
    options?.allowedRoles ?? ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES;
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
      defaultRole,
      ticket,
      ticketExpiresAt,
      isAnonymous: false,
    },
  });

  // Delete old refresh token and send email if email must be verified
  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    // delete old refresh tokens for user
    await gqlSdk.deleteUserRefreshTokens({
      userId,
    });
    // create ticket
    const ticket = `passwordlessEmail:${uuidv4()}`;
    const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

    await gqlSdk.updateUser({
      id: userId,
      user: {
        ticket,
        ticketExpiresAt,
      },
    });

    const template = 'signin-passwordless';
    await emailClient.send({
      template,
      message: {
        to: email,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket,
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
};
