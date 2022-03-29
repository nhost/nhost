// rotate provider tokens
import { RequestHandler } from 'express';
import refresh from 'passport-oauth2-refresh';

import { gqlSdk } from '@/utils/gqlSDK';
import { ENV } from '@/utils/env';
import { sendError } from '@/errors';

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

  return res.send('OK');
};
