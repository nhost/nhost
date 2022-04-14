import { Router } from 'express';
import { Strategy } from 'passport-bitbucket-oauth2';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.bitbucket;

  initProvider(router, 'bitbucket', Strategy, {}, (req, res, next) => {
    if (!options) {
      return sendError(res, 'disabled-endpoint');
    } else if (!options?.clientID || !options?.clientSecret) {
      throw new Error(`Missing environment variables for Bitbucket OAuth`);
    } else {
      return next();
    }
  });
};
