import { Router } from 'express';
import { Strategy } from 'passport-github2';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.github;

  initProvider(
    router,
    'github',
    Strategy,
    { scope: PROVIDERS.github?.scope },
    (req, res, next) => {
      if (!PROVIDERS.github) {
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for GitHub OAuth`);
      } else {
        return next();
      }
    }
  );
};
