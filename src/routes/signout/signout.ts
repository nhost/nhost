import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {
  refreshToken: string;
  all: boolean;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signOutHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { refreshToken, all } = req.body;

  if (all) {
    const user = await gqlSdk
      .getUsersByRefreshToken({
        refreshToken,
      })
      .then((res) => {
        try {
          return res.authRefreshTokens[0].user;
        } catch (error) {
          throw new Error('Invalid or expired ticket');
        }
      });

    if (!user) {
      throw new Error('Invalid or expired ticket');
    }

    await gqlSdk.deleteUserRefreshTokens({
      userId: user.id,
    });
  } else {
    // !all
    await gqlSdk.deleteRefreshToken({
      refreshToken,
    });
  }

  return res.send('OK');
};
