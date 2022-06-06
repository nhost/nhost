import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { gqlSdk, hashPassword } from '@/utils';
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

  // get the user from the ticket
  const ticketed_user = await gqlSdk
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

  // check if user is logged in or has valid ticket
  if (!req.auth?.userId && !ticketed_user) {
    return sendError(res, 'unauthenticated-user');
  }

  const { newPassword } = req.body;

  const newPasswordHash = await hashPassword(newPassword);

  const userId = req.auth?.userId || ticketed_user.id;

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
