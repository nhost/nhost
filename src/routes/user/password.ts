import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { gqlSdk, hashPassword, getUserByTicket } from '@/utils';
import { sendError } from '@/errors';
import { Joi, password } from '@/validation';

export const userPasswordSchema = Joi.object({
  newPassword: password.required(),
  ticket: Joi.string(),
}).meta({ className: 'UserPasswordSchema' });

export const userPasswordHandler: RequestHandler<
  {},
  {},
  { newPassword: string, ticket?: string }
> = async (req, res) => {

  const { ticket } = req.body;

  // get the user from the ticket, but if no ticket then return null
  const userByTicket = await getUserByTicket(ticket || "")

  // check if user is logged in or has valid ticket
  if (!req.auth?.userId && !userByTicket) {
    return sendError(res, 'unauthenticated-user');
  }

  const { newPassword } = req.body;

  const newPasswordHash = await hashPassword(newPassword);

  const userId = req.auth?.userId || userByTicket?.id;

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

  return res.send(ReasonPhrases.OK);
};
