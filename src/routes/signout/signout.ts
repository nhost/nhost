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
