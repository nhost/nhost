import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ReasonPhrases } from 'http-status-codes';

import {
  gqlSdk,
  getUserByEmail,
  insertUser,
  getGravatarUrl,
  generateTicketExpiresAt,
  ENV,
  createEmailRedirectionLink,
} from '@/utils';
import { emailClient } from '@/email';
import { EMAIL_TYPES, PasswordLessEmailBody } from '@/types';
import { sendError } from '@/errors';
import { Joi, email, registrationOptions } from '@/validation';

export const signInPasswordlessEmailSchema = Joi.object({
  email: email.required(),
  options: registrationOptions,
}).meta({ className: 'SignInPasswordlessEmailSchema' });

export const signInPasswordlessEmailHandler: RequestHandler<
  {},
  {},
  PasswordLessEmailBody
> = async (req, res) => {
  if (!ENV.AUTH_EMAIL_PASSWORDLESS_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const {
    email,
    options: {
      redirectTo,
      defaultRole,
      allowedRoles,
      displayName,
      locale,
      metadata,
    },
  } = req.body;

  // check if email already exist
  let user = await getUserByEmail(email);

  // if no user exists, create the user
  if (!user) {
    user = await insertUser({
      displayName: displayName ?? email,
      locale,
      roles: {
        // restructure user roles to be inserted in GraphQL mutation
        data: allowedRoles.map((role: string) => ({ role })),
      },
      disabled: ENV.AUTH_DISABLE_NEW_USERS,
      avatarUrl: getGravatarUrl(email),
      email,
      defaultRole,
      metadata,
    });
  }

  if (user?.disabled) {
    return sendError(res, 'disabled-user');
  }

  // create ticket
  const ticket = `passwordlessEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  const template = 'signin-passwordless';
  const link = createEmailRedirectionLink(
    EMAIL_TYPES.SIGNIN_PASSWORDLESS,
    ticket,
    redirectTo
  );
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
      ticket,
      redirectTo: encodeURIComponent(redirectTo),
      locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });

  return res.send(ReasonPhrases.OK);
};
