import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';
import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

type BodyType = {
  locale: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userMFAHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send('Incorrect access token');
  }

  const { locale } = req.body;

  // make sure locale is allowed
  if (!ENV.AUTH_LOCALE_ALLOWED_LOCALES.includes(locale)) {
    return res.boom.badRequest(
      'Locale is not part of AUTH_LOCALE_ALLOWED_LOCALES'
    );
  }

  const { userId } = req.auth;

  await gqlSdk.updateUser({
    id: userId,
    user: {
      locale,
    },
  });

  return res.send('OK');
};
