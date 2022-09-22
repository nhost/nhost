import { Router } from 'express';
import { WorkOSSSOStrategy } from 'passport-workos';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';
import Joi from 'joi';
import { queryValidator } from '@/validation';
import { getGravatarUrl } from '@/utils';

const transformProfile = ({
  id,
  email,
  first_name,
  last_name,
  raw_attributes,
}: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) => {
  const displayName =
    raw_attributes[
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    ] || `${first_name} ${last_name}`;
  return {
    id,
    email,
    displayName,
    avatarUrl: getGravatarUrl(email),
  };
};

export default (router: Router): void => {
  const config = PROVIDERS.workos;
  initProvider(
    router,
    'workos',
    WorkOSSSOStrategy,
    { transformProfile },
    (req, res, next) => {
      if (!config) {
        return sendError(res, 'disabled-endpoint');
      } else if (!config.clientID || !config.clientSecret) {
        throw new Error(`Missing environment variables for WorkOS OAuth`);
      } else {
        // * Check if at least one of the required query parameters is present: organization, domain, or connection
        // * req.query.email is deprecated in the current WorkOS API
        return queryValidator(
          Joi.object({
            organization: Joi.string().default(config.defaultOrganization),
            domain: Joi.string().default(config.defaultDomain),
            connection: Joi.string().default(config.defaultConnection),
          }).min(1)
        )(req, res, next);
      }
    }
  );
};
