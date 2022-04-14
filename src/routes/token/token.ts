import { RequestHandler } from 'express';
import { getNewSession, gqlSdk } from '@/utils';
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

  // set expiresAt to now + 10 seconds.
  // this means the refresh token is available for 10 more seconds to avoid race
  // conditions with multiple request sent by the same client. Ex multiple tabs.
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + 10);

  // get user and set new expiresAt on the used refreshToken
  const refreshTokens = await gqlSdk
    .getUsersByRefreshTokenAndUpdateRefreshTokenExpiresAt({
      refreshToken,
      expiresAt: expiresAt,
    })
    .then((gqlres) => {
      return gqlres.updateAuthRefreshTokens?.returning;
    });

  if (!refreshTokens) {
    return sendError(res, 'invalid-refresh-token');
  }

  if (refreshTokens.length === 0) {
    return sendError(res, 'invalid-refresh-token');
  }

  const user = refreshTokens[0].user;

  if (!user) {
    return sendError(res, 'invalid-refresh-token');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  // // delete current refresh token
  // await gqlSdk.deleteRefreshToken({
  //   refreshToken,
  // });

  const randomNumber = Math.floor(Math.random() * 10);

  // 10% chance
  // 1 in 10 request will delete expired refresh tokens
  // TODO: CRONJOB in the future.
  if (randomNumber === 1) {
    // no await
    gqlSdk.deleteExpiredRefreshTokens();
  }

  const session = await getNewSession({
    user,
  });

  return res.send(session);
};
