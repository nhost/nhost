import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getUserByTicket } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  ticket?: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userEmailVerifyOLDHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('inside user password handler');

  const { ticket } = req.body;

  if (!ticket) {
    return res.boom.badRequest('Missing ticket');
  }

  // get user using ticket
  const user = await getUserByTicket(ticket);

  if (!user) {
    return res.boom.badRequest('Invalid or expired ticket');
  }

  // set new email for user
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      emailVerified: true,
      ticket: null,
    },
  });

  return res.send('ok');
};
