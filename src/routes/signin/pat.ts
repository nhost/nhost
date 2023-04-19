import { sendError } from '@/errors';
import { ENV, createHasuraAccessToken, getUserByPAT } from '@/utils';
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
  const user = await getUserByPAT(req.body.personalAccessToken);

  if (!user) {
    return sendError(res, 'invalid-pat');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  const accessToken = await createHasuraAccessToken(user);

  return res.send({
    mfa: null,
    session: {
      accessToken,
      accessTokenExpiresIn: ENV.AUTH_ACCESS_TOKEN_EXPIRES_IN,
      refreshToken: null,
      user,
    },
  });
};
