import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { gqlSdk } from '@/utils/gqlSDK';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { emailClient } from '@/email';
import { ENV } from '@/utils/env';

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

  const ticket = `emailConfirmChange:${uuidv4()}`;
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
  await emailClient.send({
    template,
    locals: {
      link: `${ENV.AUTH_SERVER_URL}/verify?&ticket=${ticket}&type=emailConfirmChange&redirectTo=${redirectTo}`,
      displayName: user.displayName,
      ticket,
      redirectTo,
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
      },
    },
  });

  return res.send('ok');
};
