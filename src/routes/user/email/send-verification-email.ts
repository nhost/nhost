import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ReasonPhrases } from 'http-status-codes';

import { gqlSdk, generateTicketExpiresAt, getUserByEmail, ENV } from '@/utils';
import { emailClient } from '@/email';
import { sendError } from '@/errors';
import { Joi, email, redirectTo } from '@/validation';

export const userEmailSendVerificationEmailSchema = Joi.object({
  email: email.required(),
  options: Joi.object({
    redirectTo,
  }).default(),
}).meta({ className: 'UserEmailSendVerificationEmailSchema' });

export const userEmailSendVerificationEmailHandler: RequestHandler<
  {},
  {},
  {
    email: string;
    options: {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const {
    email,
    options: { redirectTo },
  } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.emailVerified) {
    return sendError(res, 'email-already-verified');
  }

  // TODO: possibly check when last email was sent to minimize abuse

  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60 * 24 * 30); // 30 days

  // set newEmail for user
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  const template = 'email-verify';
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
      link: `${ENV.AUTH_SERVER_URL}/verify?&ticket=${ticket}&type=emailVerify&redirectTo=${redirectTo}`,
      displayName: user.displayName,
      ticket,
      redirectTo,
      locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });

  return res.send(ReasonPhrases.OK);
};
