import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { gqlSdk } from '../gqlSDK';
import { isValidEmail } from '../email';
import { getUserByEmail } from '@/helpers';
import { isRolesValid } from '../roles';
import { ENV } from '../env';
import { emailClient } from '@/email';
import { generateTicketExpiresAt } from '../ticket';

export type BodyTypePasswordlessEmail = {
  signInMethod: 'passwordless';
  connection: 'email';
  email: string;
  allowedRoles?: string[];
  defaultRole?: string;
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

  const { email } = body;

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
  const defaultRole = body.defaultRole ?? ENV.AUTH_DEFAULT_USER_ROLE;
  const allowedRoles = body.allowedRoles ?? ENV.AUTH_DEFAULT_ALLOWED_USER_ROLES;
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

  // delete old refresh tokens for user
  await gqlSdk.deleteUserRefreshTokens({
    userId,
  });

  if (!ENV.AUTH_DISABLE_NEW_USERS && ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    if (!ENV.AUTH_EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable');
    }

    // create ticket
    const ticket = `passwordlessEmai:${uuidv4()}`;
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
        locale: user.locale,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }
};
