import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getUserByTicket } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  ticket: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userEmailHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('inside user password handler');

  const { ticket } = req.body;

  // if (newEmail) {
  //   if (!req.auth?.userId) {
  //     return res.boom.forbidden('User must be signed in');
  //   }

  //   const { userId } = req.auth;

  //   if (!EmailValidator.validate(newEmail)) {
  //     return res.boom.badRequest(
  //       'Invalid: newEmail is not a valid email address'
  //     );
  //   }

  //   await gqlSdk.updateUser({
  //     id: userId,
  //     user: {
  //       email: newEmail,
  //     },
  //   });

  //   return res.send('ok');
  // }

  if (!ticket) {
    return res.boom.badRequest('Missing ticket');
  }

  // get user using ticket
  const user = await getUserByTicket(ticket);

  if (!user) {
    return res.boom.unauthorized('Invalid or expired ticket');
  }

  // set new email for user
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      email: user.newEmail,
      newEmail: null,
      ticket: null,
    },
  });

  return res.send('ok');
};
