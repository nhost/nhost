import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { gqlSdk, hashPassword } from '@/utils';
import { sendError } from '@/errors';
import { Joi, password } from '@/validation';

export const userPasswordSchema = Joi.object({
  newPassword: password.required(),
}).meta({ className: 'UserPasswordSchema' });

export const userPasswordHandler: RequestHandler<
  {},
  {},
  { newPassword: string }
> = async (req, res) => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return sendError(res, 'unauthenticated-user');
  }

  const { newPassword } = req.body;

  const newPasswordHash = await hashPassword(newPassword);

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.isAnonymous) {
    return sendError(res, 'forbidden-anonymous');
  }

  // set new password for user
  await gqlSdk.updateUser({
    id: userId,
    user: {
      passwordHash: newPasswordHash,
    },
  });

  return res.send(ReasonPhrases.OK);
};
