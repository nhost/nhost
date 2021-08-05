import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { emailClient } from '@/email';
import { getUserByEmail } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { APPLICATION } from '@config/application';
import { generateTicketExpiresAt } from '@/utils/ticket';

type BodyType = {
  email: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userPasswordResetHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { email } = req.body;

  const user = await getUserByEmail(email);

  if (!user || user.disabled) {
    return res.boom.badRequest('No user with such email exists');
  }

  const ticket = `passwordReset:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60); // 1 hour

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  await emailClient.send({
    template: 'password-reset',
    locals: {
      ticket,
      url: APPLICATION.SERVER_URL,
      locale: user.locale,
      appUrl: APPLICATION.APP_URL,
      displayName: user.displayName,
    },
    message: {
      to: email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket as string,
        },
        'x-email-template': {
          prepared: true,
          value: 'password-reset',
        },
      },
    },
  });

  return res.send('OK');
};
