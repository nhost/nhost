import { Router } from 'express';
import { Strategy } from 'passport-google-oauth20';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

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
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Google OAuth`);
      } else {
        return next();
      }
    }
  );
};
