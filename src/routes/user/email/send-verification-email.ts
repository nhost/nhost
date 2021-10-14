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
import { getUserByEmail } from '@/helpers';
import { ENV } from '@/utils/env';

type BodyType = {
  email: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userEmailSendVerificationEmailHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('inside user email reset handler');

  const { email } = req.body;

  if (!ENV.AUTH_EMAILS_ENABLED) {
    throw new Error('SMTP settings unavailable');
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
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  // set newEmail for user
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  await emailClient.send({
    template: 'verify-email',
    message: {
      to: email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket,
        },
        'x-email-template': {
          prepared: true,
          value: 'verify-email',
        },
      },
    },
    locals: {
      displayName: user.displayName,
      ticket,
      locale: user.locale,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });

  return res.send('ok');
};
