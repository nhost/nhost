import { Router } from 'express';
import { Strategy } from '@oauth-everything/passport-discord';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
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
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Discord OAuth`);
      } else {
        return next();
      }
    }
  );
};
