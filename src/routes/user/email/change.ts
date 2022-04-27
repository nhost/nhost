import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ReasonPhrases } from 'http-status-codes';

import {
  gqlSdk,
  generateTicketExpiresAt,
  ENV,
  createEmailRedirectionLink,
} from '@/utils';
import { emailClient } from '@/email';
import { Joi, email, redirectTo } from '@/validation';
import { EMAIL_TYPES } from '@/types';

export const userEmailChangeSchema = Joi.object({
  newEmail: email,
  options: Joi.object({
    redirectTo,
  }).default(),
}).meta({ className: 'UserEmailChangeSchema' });

export const userEmailChange: RequestHandler<
  {},
  {},
  {
    newEmail: string;
    options: {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const {
    newEmail,
    options: { redirectTo },
  } = req.body;

  const { userId } = req.auth as RequestAuth;

  const ticket = `${EMAIL_TYPES.CONFIRM_CHANGE}:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60); // 1 hour

  // set newEmail for user
  const updatedUserResponse = await gqlSdk.updateUser({
    id: userId,
    user: {
      ticket,
      ticketExpiresAt,
      newEmail,
    },
  });

  const user = updatedUserResponse.updateUser;

  if (!user) {
    throw new Error('Unable to get user');
  }

  const template = 'email-confirm-change';
  const link = createEmailRedirectionLink(
    EMAIL_TYPES.CONFIRM_CHANGE,
    ticket,
    redirectTo
  );
  await emailClient.send({
    template,
    locals: {
      link,
      displayName: user.displayName,
      ticket,
      redirectTo: encodeURIComponent(redirectTo),
      locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
    message: {
      to: newEmail,
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
  });

  return res.send(ReasonPhrases.OK);
};
