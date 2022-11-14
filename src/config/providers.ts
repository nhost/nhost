import { castBooleanEnv, castStringArrayEnv, castStringEnv } from '@config';

export const PROVIDERS = {
  get apple() {
    if (!castBooleanEnv('AUTH_PROVIDER_APPLE_ENABLED')) {
      return null;
    } else {
      try {
        return {
          get clientID() {
            return castStringEnv('AUTH_PROVIDER_APPLE_CLIENT_ID');
          },
          get teamID() {
            return castStringEnv('AUTH_PROVIDER_APPLE_TEAM_ID');
          },
          get keyID() {
            return castStringEnv('AUTH_PROVIDER_APPLE_KEY_ID');
          },
          get privateKeyString() {
            return castStringEnv('AUTH_PROVIDER_APPLE_PRIVATE_KEY').replace(
              /\\n/g,
              '\n'
            );
          },
          get scope() {
            return castStringArrayEnv('AUTH_PROVIDER_APPLE_SCOPE', [
              'name',
              'email',
            ]);
          },
        };
      } catch (e) {
        throw new Error(`Invalid Apple OAuth Key file`);
      }
    }
  },
};
