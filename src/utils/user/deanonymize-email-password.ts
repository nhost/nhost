import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ReasonPhrases } from 'http-status-codes';

import { pgClient, createEmailRedirectionLink, getUserByEmail } from '@/utils';
import { sendEmail } from '@/email';
import { sendError } from '@/errors';

import { ENV } from '../env';
import { generateTicketExpiresAt } from '../ticket';
import { hashPassword } from '../password';
import { EMAIL_TYPES } from '@/types';

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
  const user = await pgClient.getUserById(userId);
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
  await pgClient.deleteUserRolesByUserId(userId);

  // insert new user roles (userRoles)
  await pgClient.insertUserRoles(userId, allowedRoles);

  // TODO use createVerifyEmailTicket()
  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  await pgClient.updateUser({
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
    await pgClient.deleteUserRefreshTokens(userId);

    const template = 'email-verify';
    const link = createEmailRedirectionLink(
      EMAIL_TYPES.VERIFY,
      ticket,
      redirectTo
    );
    await sendEmail({
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
          'x-link': {
            prepared: true,
            value: link,
          },
        },
      },
      locals: {
        link,
        displayName: user.displayName,
        email,
        newEmail: user.newEmail,
        ticket,
        redirectTo: encodeURIComponent(redirectTo),
        locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }

  res.json(ReasonPhrases.OK);
};
