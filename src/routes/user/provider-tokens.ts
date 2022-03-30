// rotate provider tokens
import { RequestHandler } from 'express';
import refresh from 'passport-oauth2-refresh';
import { ReasonPhrases } from 'http-status-codes';

import { gqlSdk, ENV } from '@/utils';
import { sendError } from '@/errors';
import { Joi, userId } from '@/validation';

type BodyType = {
  providerId: string;
  userId?: string;
};

const rotate = async ({ providerId, userId }: BodyType) => {
  const { authUserProviders } = await gqlSdk.userProvider({
    userId,
    providerId,
  });

  const authUserProvider = authUserProviders[0];

  if (!authUserProvider) {
    throw new Error('Could not get user');
  }

  if (!authUserProvider.refreshToken) {
    throw new Error('No refresh token found for provider id for user');
  }

  refresh.requestNewAccessToken(
    providerId,
    authUserProvider.refreshToken,
    async (err: unknown, accessToken: string, refreshToken: string) => {
      if (err) {
        throw new Error('error refreshing tokens');
      }

      // save new token(s)
      // possibly reuse old refresh token
      // https://github.com/fiznool/passport-oauth2-refresh/issues/8#issuecomment-306935733
      await gqlSdk.updateAuthUserprovider({
        id: authUserProvider.id,
        authUserProvider: {
          accessToken,
          refreshToken: refreshToken
            ? refreshToken
            : authUserProvider.refreshToken,
        },
      });
    }
  );
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

  const { providerId, userId } = req.body;

  await rotate({ providerId, userId });

  return res.send(ReasonPhrases.OK);
};
