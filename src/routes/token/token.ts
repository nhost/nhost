import { RequestHandler } from 'express';
import { getNewSession } from '@/utils/tokens';
import { gqlSdk } from '@/utils/gqlSDK';

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
    return res.boom.unauthorized('Invalid or expired refresh token');
  }

  if (refreshTokens.length === 0) {
    return res.boom.unauthorized('Invalid or expired refresh token');
  }

  const user = refreshTokens[0].user;

  if (!user) {
    return res.boom.unauthorized('Invalid or expired refresh token');
  }

  if (user.disabled) {
    return res.boom.unauthorized('User is disabled');
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
