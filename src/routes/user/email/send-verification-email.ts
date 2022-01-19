import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { v4 as uuidv4 } from 'uuid';

import { gqlSdk } from '@/utils/gqlSDK';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { emailClient } from '@/email';
import { getUserByEmail, isValidRedirectTo } from '@/helpers';
import { ENV } from '@/utils/env';

type BodyType = {
  email: string;
  options?: {
    redirectTo?: string;
    locale?: string;
  };
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userEmailSendVerificationEmailHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { email, options } = req.body;

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo({ redirectTo })) {
    return res.boom.badRequest(`'redirectTo' is not valid`);
  }

  const user = await getUserByEmail(email);

  if (!user) {
    return res.boom.badRequest('No user with such email');
  }

  if (user.emailVerified) {
    return res.boom.badRequest("User's email is already verified");
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
      displayName: user.displayName,
      ticket,
      redirectTo,
      locale: options?.locale ?? user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });

  return res.send('ok');
};
