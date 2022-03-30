import { Router } from 'express';
import { Strategy } from '@riderize/passport-strava-oauth2';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.strava;

  initProvider(
    router,
    'strava',
    Strategy,
    { scope: options?.scope },
    (req, res, next) => {
      if (!PROVIDERS.strava) {
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Strava OAuth`);
      } else {
        return next();
      }
    }
  );
};
