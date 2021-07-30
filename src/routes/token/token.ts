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

  const user = await gqlSdk
    .getUsersByRefreshToken({
      refreshToken,
    })
    .then((res) => {
      try {
        return res.authRefreshTokens[0].user;
      } catch (error) {
        throw new Error('Invalid or expired refresh token');
      }
    });

  if (!user) {
    throw new Error('Invalid or expired refresh token');
  }

  if (!user.isActive) {
    return res.boom.badRequest('User is not activated');
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
