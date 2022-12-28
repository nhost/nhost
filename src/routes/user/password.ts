import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { hashPassword, getUserByTicket, pgClient } from '@/utils';
import { sendError } from '@/errors';
import { Joi, password } from '@/validation';
import { User } from '@/types';

export const userPasswordSchema = Joi.object({
  newPassword: password.required(),
  ticket: Joi.string(),
}).meta({ className: 'UserPasswordSchema' });

export const userPasswordHandler: RequestHandler<
  {},
  {},
  { newPassword: string; ticket?: string }
> = async (req, res) => {
  const { ticket } = req.body;

  let user: User | null = null;
  if (ticket) {
    user = await getUserByTicket(ticket);
    if (!user) {
      return sendError(res, 'invalid-ticket');
    }
  } else {
    if (!req.auth?.userId) {
      return sendError(res, 'unauthenticated-user');
    }
    user = await pgClient.getUserById(req.auth?.userId);
  }

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.isAnonymous) {
    return sendError(res, 'forbidden-anonymous');
  }
  const { newPassword } = req.body;
  const passwordHash = await hashPassword(newPassword);

  await pgClient.updateUser({
    id: user.id,
    user: {
      passwordHash,
      ticket: ticket ? null : undefined, // Hasura does not update when variable is undefined
    },
  });
  return res.json(ReasonPhrases.OK);
};
