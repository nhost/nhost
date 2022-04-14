import { Router } from 'express';
import { Strategy } from 'passport-gitlab2';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.gitlab;

  initProvider(
    router,
    'gitlab',
    Strategy,
    {
      scope: PROVIDERS.gitlab?.scope.join(' '),
      ...(options?.baseUrl && { baseURL: options.baseUrl }),
    },
    (req, res, next) => {
      if (!PROVIDERS.gitlab) {
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Gitlab OAuth`);
      } else {
        return next();
      }
    }
  );
};
