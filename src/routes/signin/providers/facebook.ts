import { Router } from 'express';
import { Strategy } from 'passport-facebook';
import { PROVIDERS } from '@config/index';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.facebook;

  initProvider(
    router,
    'facebook',
    Strategy,
    { profileFields: PROVIDERS.facebook?.profileFields, scope: PROVIDERS.facebook?.scope },
    (req, res, next) => {
      if (!PROVIDERS.facebook) {
        return res.boom.notImplemented(`Facebook sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Facebook OAuth`);
      } else {
        return next();
      }
    }
  );
};
