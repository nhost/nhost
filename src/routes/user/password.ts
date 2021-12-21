import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { isPasswordValid } from '@/utils/password';

type BodyType = {
  newPassword: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send('Incorrect access token');
  }

  const { newPassword } = req.body;

  // check if password is compromised
  if (!(await isPasswordValid({ password: newPassword, res }))) {
    // function send potential error via `res`
    return;
  }

  const newPasswordHash = await hashPassword(newPassword);

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('Unable to get user');
  }

  // set new password for user
  await gqlSdk.updateUser({
    id: userId,
    user: {
      passwordHash: newPasswordHash,
    },
  });

  return res.send('OK');
};
