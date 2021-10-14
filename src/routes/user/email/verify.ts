import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  email: string;
  ticket: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userEmailVerifyHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('inside user password handler');

  const { ticket } = req.body;

  const user = await gqlSdk
    .users({
      where: {
        _and: [
          {
            ticket: {
              _eq: ticket,
            },
          },
          {
            ticketExpiresAt: {
              _gt: new Date(),
            },
          },
        ],
      },
    })
    .then((gqlRes) => gqlRes.users[0]);

  if (!user) {
    return res.boom.unauthorized('Invalid or expired ticket');
  }

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      emailVerified: true,
    },
  });

  return res.send('OK');
};
