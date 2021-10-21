import { Router } from 'express';
import { Strategy } from 'passport-google-oauth20';
import { initProvider } from './utils';
import { PROVIDERS } from '@config/index';

export default (router: Router): void => {
  const options = PROVIDERS.google;

  initProvider(
    router,
    'google',
    Strategy,
    {
      scope: PROVIDERS.google?.scope,
      prompt: 'consent',
      accessType: 'offline',
    },
    (req, res, next) => {
      if (!PROVIDERS.google) {
        return res.boom.notImplemented(`Google sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Google OAuth`);
      } else {
        return next();
      }
    }
  );
};
