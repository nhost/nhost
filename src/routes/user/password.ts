import { RequestHandler } from 'express';

import { hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';

export const userPasswordHandler: RequestHandler<
  {},
  {},
  { newPassword: string }
> = async (req, res) => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send('Incorrect access token');
  }

  const { newPassword } = req.body;

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
