import { RequestHandler } from 'express';

import { gqlSdk } from '@/utils/gqlSDK';

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
      return res.boom.unauthorized(
        'User must be signed in to sign out from all sessions'
      );
    }

    const { userId } = req.auth;

    await gqlSdk.deleteUserRefreshTokens({
      userId,
    });
  } else {
    // only sign out from the current session
    // delete current refresh token
    await gqlSdk.deleteRefreshToken({
      refreshToken,
    });
  }

  return res.send('OK');
};
