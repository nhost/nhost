import { RequestHandler } from 'express';
import { ValidationError, Schema } from 'joi';

import { REQUEST_VALIDATION_ERROR } from '@/errors';

const buildError = (error: ValidationError) => {
  const errorPayload = REQUEST_VALIDATION_ERROR;
  errorPayload.message = error.details
    .map((detail) => detail.message)
    .join(', ');
  return errorPayload;
};

export const bodyValidator: (schema: Schema) => RequestHandler =
  (schema) => async (req, res, next) => {
    try {
      req.body = await schema.validateAsync(req.body);
      next();
    } catch (err: any) {
      const error = buildError(err);
      return res.status(error.status).send(error);
    }
  };

export const queryValidator: (schema: Schema) => RequestHandler =
  (schema) => async (req, res, next) => {
    try {
      console.log('QUERY', req.query);
      const result = await schema.validateAsync(req.query);
      console.log('VALIDATED QUERY', result);
      req.query = result;
      next();
    } catch (err: any) {
      const error = buildError(err);
      return res.status(error.status).send(error);
    }
  };
