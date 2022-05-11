import { RequestHandler } from 'express';
import { getNewOrUpdateCurrentSession, gqlSdk } from '@/utils';
import { sendError } from '@/errors';
import { Joi, refreshToken } from '@/validation';

export const tokenSchema = Joi.object({
  refreshToken,
}).meta({ className: 'TokenSchema' });

export const tokenHandler: RequestHandler<
  {},
  {},
  { refreshToken: string }
> = async (req, res) => {
  const { refreshToken } = req.body;

  const refreshTokens = await gqlSdk
    .getUsersByRefreshTokenOld({
      refreshToken,
    })
    .then((gqlres) => {
      return gqlres.authRefreshTokens;
    });

  if (!refreshTokens) {
    return sendError(res, 'invalid-refresh-token');
  }

  if (refreshTokens.length === 0) {
    return sendError(res, 'invalid-refresh-token');
  }

  const user = refreshTokens[0].user;
  const currentRefreshToken = refreshToken;

  if (!user) {
    return sendError(res, 'invalid-refresh-token');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  const randomNumber = Math.floor(Math.random() * 10);

  // 10% chance
  // 1 in 10 request will delete expired refresh tokens
  // TODO: CRONJOB in the future.
  if (randomNumber === 1) {
    // no await
    gqlSdk.deleteExpiredRefreshTokens();
  }

  const session = await getNewOrUpdateCurrentSession({
    user,
    currentRefreshToken,
  });

  return res.send(session);
};
