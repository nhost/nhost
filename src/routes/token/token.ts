import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getNewTokens } from '@/utils/tokens';
import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  refreshToken: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const tokenHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { refreshToken } = req.body;

  const refreshTokens = await gqlSdk
    .getUsersByRefreshToken({
      refreshToken,
    })
    .then((gqlres) => {
      return gqlres.authRefreshTokens;
    });

  if (refreshTokens.length === 0) {
    return res.boom.unauthorized('Invalid or expired refresh token');
  }

  const user = refreshTokens[0].user;

  if (!user) {
    return res.boom.unauthorized('Invalid or expired refresh token');
  }

  if (!user.isActive) {
    return res.boom.unauthorized('User is not activated');
  }

  // delete current refresh token
  await gqlSdk.deleteRefreshToken({
    refreshToken,
  });

  const tokens = await getNewTokens({
    user,
  });

  return res.send(tokens);
};
