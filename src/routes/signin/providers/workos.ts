import { Router } from 'express';
import { WorkOSSSOStrategy } from 'passport-workos';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';
import Joi from 'joi';
import { queryValidator } from '@/validation';

export default (router: Router): void => {
  const config = PROVIDERS.workos;
  initProvider(router, 'workos', WorkOSSSOStrategy, {}, (req, res, next) => {
    if (!config) {
      return sendError(res, 'disabled-endpoint');
    } else if (!config.clientID || !config.clientSecret) {
      throw new Error(`Missing environment variables for WorkOS OAuth`);
    } else {
      // TODO set a default organization/domain/connection as env var
      req.query.organization = 'org_01GC9CW1NCVZ9R1P9XMP0AYG36';
      // * Check if at least one of the required query parameters is present: organization, domain, or connection
      // * req.query.email is deprecated in the current WorkOS API
      return queryValidator(
        Joi.object({
          organization: Joi.string(),
          domain: Joi.string(),
          connection: Joi.string(),
        }).min(1)
      )(req, res, next);
    }
  });
};
