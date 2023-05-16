import { sendError } from '@/errors';
import { logger } from '@/logger';
import { ENV, createHasuraAccessToken, getUser, getUserByPAT } from '@/utils';
import { personalAccessToken } from '@/validation';
import { RequestHandler } from 'express';
import Joi from 'joi';

export const signInPATSchema = Joi.object({
  personalAccessToken,
}).meta({ className: 'SignInPATSchema' });

export const signInPATHandler: RequestHandler<
  {},
  {},
  { personalAccessToken: string }
> = async (req, res) => {
  try {
    const user = await getUserByPAT(req.body.personalAccessToken);

    if (!user) {
      return sendError(res, 'invalid-pat');
    }

    if (user.disabled) {
      return sendError(res, 'disabled-user');
    }

    const accessToken = await createHasuraAccessToken(user);
    const sessionUser = await getUser({ userId: user.id });

    return res.send({
      mfa: null,
      session: {
        accessToken,
        accessTokenExpiresIn: ENV.AUTH_ACCESS_TOKEN_EXPIRES_IN,
        refreshToken: null,
        refreshTokenId: null,
        user: sessionUser,
      },
    });
  } catch (error) {
    logger.error(error);

    if (error instanceof Error) {
      return sendError(res, 'internal-error', { customMessage: error.message });
    }

    return sendError(res, 'internal-error');
  }
};
