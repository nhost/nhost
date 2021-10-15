import { Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { pwnedPassword } from 'hibp';

import { hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';

type BodyType = {
  oldPassword: string;
  newPassword: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('inside user password handler');

  const { oldPassword, newPassword } = req.body;

  // check if password is compromised
  if (ENV.AUTH_HIBP_ENABLED && (await pwnedPassword(newPassword))) {
    return res.boom.badRequest('Password is too weak');
  }

  const newPasswordHash = await hashPassword(newPassword);

  if (!req.auth?.userId) {
    return res.boom.unauthorized('User must be signed in');
  }

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('Unable to get user');
  }

  // const oldPasswordHash = await hashPassword(oldPassword);
  // if no password is set, don't care about the old password
  const isPasswordCorrect = !user.passwordHash
    ? true
    : await bcrypt.compare(oldPassword, user.passwordHash);

  if (!isPasswordCorrect) {
    console.log(user.passwordHash);
    console.log(oldPassword);

    return res.boom.badRequest('Incorrect old password');
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
