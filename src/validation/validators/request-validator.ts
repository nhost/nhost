import { RequestHandler } from 'express';
import { ValidationError, Schema, AsyncValidationOptions } from 'joi';

import { sendError } from '@/errors';
import { ENV } from '@/utils';

const requestValidator: (
  payload: 'body' | 'query'
) => (schema: Schema) => RequestHandler =
  (payload) => (schema) => async (req, res, next) => {
    try {
      const options: AsyncValidationOptions =
        payload === 'query' ? { convert: true, allowUnknown: true } : {};
      req[payload] = await schema.validateAsync(req[payload], options);
      next();
    } catch (err: any) {
      const error: ValidationError = err;
      return sendError(res, 'invalid-request', {
        customMessage: error.details.map((detail) => detail.message).join(', '),
        // * If redirectTo is not valid, fall back to the default client url AUTH_CLIENT_URL
        // * Else, use the redirectTo from the original request
        redirectTo: error.details.some((detail) =>
          detail.path.includes('redirectTo')
        )
          ? ENV.AUTH_CLIENT_URL
          : error._original.redirectTo,
      });
    }
  };

export const bodyValidator = requestValidator('body');
export const queryValidator = requestValidator('query');
