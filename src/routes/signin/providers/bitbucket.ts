import { Router } from 'express';
import { Strategy } from 'passport-bitbucket-oauth2';
import { PROVIDERS } from '@config/index';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.bitbucket;

  initProvider(router, 'bitbucket', Strategy, {}, (req, res, next) => {
    if (!options) {
      return res.boom.notImplemented(`BitBucket sign-in is not enabled`);
    } else if (!options?.clientID || !options?.clientSecret) {
      throw new Error(`Missing environment variables for Bitbucket OAuth`);
    } else {
      return next();
    }
  });
};
