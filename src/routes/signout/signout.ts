import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { deleteRefreshToken, deleteUserRefreshTokens } from '@/utils';
import { sendError } from '@/errors';
import { Joi, refreshToken } from '@/validation';

export const signOutSchema = Joi.object({
  refreshToken,
  all: Joi.boolean()
    .default(false)
    .description('Sign out from all connected devices'),
}).meta({ className: 'SignOutSchema' });

export const signOutHandler: RequestHandler<
  {},
  {},
  {
    refreshToken: string;
    all: boolean;
  }
> = async (req, res) => {
  const { refreshToken, all } = req.body;

  if (all) {
    if (!req.auth?.userId) {
      return sendError(res, 'unauthenticated-user', {
        customMessage: 'User must be signed in to sign out from all sessions',
      });
    }

    const { userId } = req.auth;
    await deleteUserRefreshTokens(userId);
  } else {
    // only sign out from the current session
    // delete current refresh token
    await deleteRefreshToken(refreshToken);
  }

  return res.json(ReasonPhrases.OK);
};
