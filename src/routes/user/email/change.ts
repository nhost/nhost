import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { gqlSdk } from '@/utils/gqlSDK';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { emailClient } from '@/email';
import { ENV } from '@/utils/env';
import { isValidRedirectTo } from '@/helpers';

type BodyType = {
  newEmail: string;
  options?: {
    redirectTo?: string;
  };
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userEmailChange = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { newEmail, options } = req.body;

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo({ redirectTo })) {
    return res.boom.badRequest(`'redirectTo' is not valid`);
  }

  if (!req.auth?.userId) {
    return res.boom.unauthorized('User must be signed in');
  }

  const { userId } = req.auth;

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
