import { Router } from 'express';
import { Strategy } from '@oauth-everything/passport-twitch';
import { PROVIDERS } from '@config/index';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.twitch;

  initProvider(
    router,
    'twitch',
    Strategy,
    { scope: PROVIDERS.twitch?.scope },
    (req, res, next) => {
      if (!PROVIDERS.twitch) {
        return res.boom.notImplemented(`Twitch sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Twitch OAuth`);
      } else {
        return next();
      }
    }
  );
};
