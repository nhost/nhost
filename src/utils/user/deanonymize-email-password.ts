import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { gqlSdk } from '../gqlSDK';
import { getUserByEmail, hashPassword } from '@/helpers';
import { ENV } from '../env';
import { emailClient } from '@/email';
import { generateTicketExpiresAt } from '../ticket';
import { sendError } from '@/errors';

export type BodyTypeEmailPassword = {
  signInMethod: 'email-password';
  email: string;
  password: string;
  options: {
    locale: string;
    allowedRoles: string[];
    defaultRole: string;
    redirectTo: string;
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
    return sendError(res, 'user-not-anonymous');
  }

  const {
    email,
    password,
    options: { redirectTo, defaultRole, allowedRoles },
  } = body;

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const passwordHash = await hashPassword(password);

  // delete existing (anonymous) user roles
  await gqlSdk.deleteUserRolesByUserId({
    userId,
  });

  // insert new user roles (userRoles)
  await gqlSdk.insertUserRoles({
    userRoles: allowedRoles.map((role: string) => ({ role, userId })),
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

  // delete old refresh tokens and send email if user must verify their email
  // before they can sign in.
  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    await gqlSdk.deleteUserRefreshTokens({
      userId,
    });

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
        link: `${ENV.AUTH_SERVER_URL}/verify?&ticket=${ticket}&type=emailVerify&redirectTo=${redirectTo}`,
        displayName: user.displayName,
        email,
        ticket,
        redirectTo,
        locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }

  res.send('ok');
};
