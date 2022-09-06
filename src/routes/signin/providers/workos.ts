import { Router } from 'express';
import { WorkOSSSOStrategy } from 'passport-workos';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const config = PROVIDERS.workos;
  initProvider(router, 'workos', WorkOSSSOStrategy, {}, (req, res, next) => {
    if (!config) {
      return sendError(res, 'disabled-endpoint');
    } else if (!config.clientID || !config.clientSecret) {
      throw new Error(`Missing environment variables for WorkOS OAuth`);
    } else {
      console.log(req.query);
      // TODO check:
      // if ([connection, domain, email, organization].every(a => a === undefined)) {
      //   console.log("ERROR HERE")
      //   throw Error("One of 'connection', 'domain', 'organization' and/or 'email' are required");
      // }
      // TODO email is deprecated
      req.query.organization = 'org_01GC9CW1NCVZ9R1P9XMP0AYG36';
      return next();
    }
  });
};
