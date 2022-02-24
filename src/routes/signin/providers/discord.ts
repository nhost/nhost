import { Router } from 'express';
import { Strategy } from '@oauth-everything/passport-discord';
import { PROVIDERS } from '@config/index';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.discord;

  initProvider(
    router,
    'discord',
    Strategy,
    { scope: PROVIDERS.discord?.scope },
    (req, res, next) => {
      if (!PROVIDERS.discord) {
        return res.boom.notImplemented(`Discord sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Discord OAuth`);
      } else {
        return next();
      }
    }
  );
};
