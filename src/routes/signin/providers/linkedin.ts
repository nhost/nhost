import { Router } from 'express';
import { Strategy } from 'passport-linkedin-oauth2';
import { initProvider } from './utils';
import { PROVIDERS } from '@config/index';

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
        return res.boom.notImplemented(`LinkedIn sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for LinkedIn OAuth`);
      } else {
        return next();
      }
    }
  );
};
