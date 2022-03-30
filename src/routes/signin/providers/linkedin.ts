import { Router } from 'express';
import { Strategy } from 'passport-linkedin-oauth2';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.linkedin;

  initProvider(
    router,
    'linkedin',
    Strategy,
    {
      scope: PROVIDERS.linkedin?.scope,
    },
    (req, res, next) => {
      if (!PROVIDERS.linkedin) {
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for LinkedIn OAuth`);
      } else {
        return next();
      }
    }
  );
};
