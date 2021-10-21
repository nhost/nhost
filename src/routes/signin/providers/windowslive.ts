import { Router } from 'express';
import { Strategy } from 'passport-windowslive';
import { initProvider } from './utils';
import { PROVIDERS } from '@config/index';

export default (router: Router): void => {
  const options = PROVIDERS.windowslive;

  initProvider(
    router,
    'windowslive',
    Strategy,
    {
      scope: PROVIDERS.windowslive?.scope,
    },
    (req, res, next) => {
      if (!PROVIDERS.windowslive) {
        return res.boom.notImplemented(`WindowsLive sign-in is not enabled`);
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Windows Live OAuth`);
      } else {
        return next();
      }
    }
  );
};
