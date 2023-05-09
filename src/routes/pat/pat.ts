import { sendError } from '@/errors';
import { logger } from '@/logger';
import { getUser, gqlSdk } from '@/utils';
import { AuthRefreshTokenTypes_Enum } from '@/utils/__generated__/graphql-request';
import { RequestHandler } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

export const createPATSchema = Joi.object({
  expiresAt: Joi.date().required(),
  metadata: Joi.object(),
}).meta({ className: 'CreatePATSchema' });

export const createPATHandler: RequestHandler<
  {},
  {},
  { metadata: object; expiresAt: Date }
> = async (req, res) => {
  if (!req.auth) {
    return sendError(res, 'unauthenticated-user');
  }

  try {
    const { userId } = req.auth as RequestAuth;

    const user = await getUser({ userId });

    if (!user) {
      return sendError(res, 'user-not-found');
    }

    const { metadata, expiresAt } = req.body;

    // Note: Joi wouldn't work here because we need to compare the date to the
    // date of the request, not the date when the schema was created
    // 7 days
    if (
      new Date(expiresAt).setHours(0, 0, 0, 0) <
      new Date().setHours(0, 0, 0, 0) + 7 * 24 * 60 * 60 * 1000
    ) {
      return sendError(res, 'invalid-expiry-date', {
        customMessage: 'The expiry date must be at least 7 days from now',
      });
    }

    const { id } = user;

    const personalAccessToken = uuidv4();

    await gqlSdk.insertRefreshToken({
      refreshToken: {
        userId: id,
        refreshToken: personalAccessToken,
        expiresAt: new Date(expiresAt),
        metadata,
        type: AuthRefreshTokenTypes_Enum.Pat,
      },
    });

    return res.send({
      personalAccessToken,
    });
  } catch (error) {
    logger.error(error);

    if (error instanceof Error) {
      return sendError(res, 'internal-error', { customMessage: error.message });
    }

    return sendError(res, 'internal-error');
  }
};
