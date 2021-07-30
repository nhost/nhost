import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { gqlSdk } from '@/utils/gqlSDK';
import { insertProfile } from '@/utils/profile';
import { ENV } from '@config/env';
import { getSignInTokens } from '@/utils/tokens';

type Profile = {
  [key: string]: string | number | boolean;
};

type BodyType = {
  locale: string;
  displayName: string;
  profile: Profile | null;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInAnonymousHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  console.log('sign up email password handler');

  if (!ENV.ANONYMOUS_USERS_ENABLED) {
    return res.boom.notFound('Anonymous users are not enabled');
  }

  const { locale, profile } = req.body;

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = [{ role: 'anonymous' }];

  const displayName = req.body.displayName ?? 'Anonymous User';

  // insert user
  const user = await gqlSdk
    .insertUser({
      user: {
        displayName,
        email: null,
        passwordHash: null,
        isActive: true,
        emailVerified: false,
        locale,
        defaultRole: 'anonymous',
        roles: {
          data: userRoles,
        },
        isAnonymous: true,
      },
    })
    .then((res) => res.insertUser);

  if (!user) {
    throw new Error('Unable to insert new user');
  }

  await insertProfile({ userId: user.id, profile });

  const signInTokens = await getSignInTokens({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInTokens);
};
