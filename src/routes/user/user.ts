import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getUser } from '@/utils/user';

type BodyType = {};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!req.auth?.userId) {
    return res.boom.unauthorized('User not signed in');
  }

  const { userId } = req.auth;

  const user = await getUser({ userId });

  return res.send({
    ...user,
  });
};
