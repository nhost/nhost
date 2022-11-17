// rotate provider tokens
import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import { ENV } from '@/utils';
import { sendError } from '@/errors';
import { Joi, userId } from '@/validation';
import { logger } from '@/logger';

type BodyType = {
  providerId: string;
  userId?: string;
};

export const userProviderTokensSchema = Joi.object({
  providerId: Joi.string().required(),
  userId: userId.required(),
}).meta({ className: 'UserProviderTokensSchema' });

export const userProviderTokensHandler: RequestHandler<
  {},
  {},
  BodyType
> = async (req, res) => {
  const adminSecret = req.headers['x-hasura-admin-secret'];

  if (adminSecret !== ENV.HASURA_GRAPHQL_ADMIN_SECRET) {
    return sendError(res, 'invalid-admin-secret');
  }

  logger.warn(`/user/provider/tokens is deprecated`);
  return res.json(ReasonPhrases.OK);
};
