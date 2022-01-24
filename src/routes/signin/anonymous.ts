import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { ENV } from '@/utils/env';
import { getSignInResponse } from '@/utils/tokens';
import { insertUser } from '@/utils/user';

type BodyType = {
  locale?: string;
  displayName?: string;
  custom?: Record<string, unknown>;
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

  const { locale = ENV.AUTH_LOCALE_DEFAULT } = req.body;

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = [{ role: 'anonymous' }];

  const displayName = req.body.displayName ?? 'Anonymous User';

  // insert user
  const user = await insertUser({
    displayName,
    locale,
    roles: {
      data: userRoles,
    },
    defaultRole: 'anonymous',
    isAnonymous: true,
    custom: {},
  });

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
