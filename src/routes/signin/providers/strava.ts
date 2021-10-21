import { Router } from 'express';
import { Strategy } from '@riderize/passport-strava-oauth2';
import { PROVIDERS } from '@config/index';
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
        return res.boom.notImplemented(`Strava sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Strava OAuth`);
      } else {
        console.log('next function 0');
        console.log(next);
        console.log(JSON.stringify(next, null, 2));

        return next();
      }
    }
  );
};
