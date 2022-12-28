import { RequestHandler } from 'express';

import { getSignInResponse, insertUser, ENV } from '@/utils';
import { sendError } from '@/errors';
import { Joi, displayName, locale, metadata } from '@/validation';

export const signInAnonymousSchema = Joi.object({
  locale,
  displayName,
  metadata,
}).meta({ className: 'SignInAnonymousSchema' });

type BodyType = {
  locale: string;
  displayName?: string;
  metadata: Record<string, unknown>;
};

export const signInAnonymousHandler: RequestHandler<{}, {}, BodyType> = async (
  req,
  res
) => {
  if (!ENV.AUTH_ANONYMOUS_USERS_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }
  const { locale, displayName = 'Anonymous User' } = req.body;

  // insert user
  const user = await insertUser({
    displayName,
    locale,
    roles: ['anonymous'],
    defaultRole: 'anonymous',
    isAnonymous: true,
    metadata: {},
  });

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
