import { gqlSdk } from '@/utils/gqlSDK';
import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

type BodyType = {
  ticket: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userActivateHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { ticket } = req.body;

  const user = await gqlSdk
    .updateUsersByTicket({
      ticket,
      user: {
        isActive: true,
        emailVerified: true,
        ticket: null,
      },
    })
    .then((res) => res.updateUsers);

  if (user?.affected_rows === 0) {
    return res.status(401).send('Invalid or expired ticket');
  }

  console.log(user);

  return res.send('OK');
};
