import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getProfileFieldsForAccessToken } from '@/utils/profile';
import { gqlSdk } from '@/utils/gqlSDK';

type BodyType = {};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!req.auth?.userId) {
    return res.boom.unauthorized('User not signed in');
  }

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('Unable to get suer');
  }

  const profile = await getProfileFieldsForAccessToken({ userId });

  return res.send({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarURL: user.avatarUrl,
    profile,
  });
};
