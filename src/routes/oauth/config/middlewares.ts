import { RequestHandler } from 'express';
import { sendError } from '@/errors';

/**
 * Optional provider-specific pre-request middlewares
 */
export const PRE_REQUEST_PROVIDER_MIDDLEWARES: Record<string, RequestHandler> =
  {
    workos: (
      {
        query: {
          organization = process.env.AUTH_PROVIDER_WORKOS_DEFAULT_ORGANIZATION,
          connection = process.env.AUTH_PROVIDER_WORKOS_DEFAULT_CONNECTION,
          domain = process.env.AUTH_PROVIDER_WORKOKS_DEFAULT_DOMAIN,
        },
      },
      res,
      next
    ) => {
      if (!(organization || connection || domain)) {
        return sendError(res, 'invalid-request', {
          customMessage:
            'You need to give either an organization, a domain or a connection to be able to authenticate with WorkOS',
          redirectTo: res.locals.redirectTo,
        });
      }
      res.locals.grant = {
        dynamic: {
          custom_params: { organization, connection, domain },
        },
      };
      next();
    },
  };
