import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { gqlSdk } from '@/utils/gqlSDK';
import { insertProfile, isProfileValid } from '@/utils/profile';
import { ENV } from '@/utils/env';
import { getSignInResponse } from '@/utils/tokens';
import { Profile } from '@/types';

type BodyType = {
  locale?: string;
  displayName?: string;
  profile?: Profile;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInAnonymousHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.AUTH_ANONYMOUS_USERS_ENABLED) {
    return res.boom.notFound('Anonymous users are not enabled');
  }

  const { profile, locale = ENV.AUTH_DEFAULT_LOCALE } = req.body;

  // check profile
  if (!(await isProfileValid({ profile, res }))) {
    // function send potential error via `res`
    return;
  }

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = [{ role: 'anonymous' }];

  const displayName = req.body.displayName ?? 'Anonymous User';

  // insert user
  const user = await gqlSdk
    .insertUser({
      user: {
        displayName,
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

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
