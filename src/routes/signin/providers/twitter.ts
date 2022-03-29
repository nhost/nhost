import { Router } from 'express';
import { Strategy } from 'passport-twitter';
import { initProvider } from './utils';
import { PROVIDERS } from '@config/index';
import { sendError } from '@/errors';

export default (router: Router): void => {
  const options = PROVIDERS.twitter;

  initProvider(
    router,
    'twitter',
    Strategy,
    {
      userProfileURL:
        'https://api.twitter.com/1.1/user/verify_credentials.json?include_email=true',
      includeEmail: true,
    },
    (req, res, next) => {
      if (!PROVIDERS.twitter) {
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.consumerKey || !options?.consumerSecret) {
        throw new Error(`Missing environment variables for Twitter OAuth`);
      } else {
        return next();
      }
    }
  );
};
