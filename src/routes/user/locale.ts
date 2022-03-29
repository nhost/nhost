import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';
import { RequestHandler } from 'express';

export const userMFAHandler: RequestHandler<
  {},
  {},
  { locale: string }
> = async (req, res) => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.status(401).send('Incorrect access token');
  }

  const { locale } = req.body;

  // TODO check Joi validation
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
