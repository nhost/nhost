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

  const user = (
    await gqlSdk.getUsersByRefreshTokenOld({
      refreshToken,
    })
  ).authRefreshTokens[0]?.user;

  if (!user) {
    return sendError(res, 'invalid-refresh-token');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  // 1 in 10 request will delete expired refresh tokens
  // TODO: CRONJOB in the future.
  if (Math.random() < 0.1) {
    // no await
    gqlSdk.deleteExpiredRefreshTokens();
  }

  const session = await getNewOrUpdateCurrentSession({
    user,
    currentRefreshToken: refreshToken,
  });

  return res.send(session);
};
