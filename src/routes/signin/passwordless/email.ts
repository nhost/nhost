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
import { sendEmail } from '@/email';
import { EMAIL_TYPES, UserRegistrationOptionsWithRedirect } from '@/types';
import { sendError } from '@/errors';
import { Joi, email, registrationOptions } from '@/validation';

export type PasswordLessEmailRequestBody = {
  email: string;
  options: UserRegistrationOptionsWithRedirect;
};

export const signInPasswordlessEmailSchema =
  Joi.object<PasswordLessEmailRequestBody>({
    email: email.required(),
    options: registrationOptions,
  }).meta({ className: 'SignInPasswordlessEmailSchema' });

export const signInPasswordlessEmailHandler: RequestHandler<
  {},
  {},
  PasswordLessEmailRequestBody
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
    if (ENV.AUTH_DISABLE_SIGNUP) {
      return sendError(res, 'signup-disabled');
    }

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

  return res.json(ReasonPhrases.OK);
};
