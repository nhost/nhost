import { Router } from 'express';
import { Strategy } from 'passport-windowslive';

import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

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
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Windows Live OAuth`);
      } else {
        return next();
      }
    }
  );
};
