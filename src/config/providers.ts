import { castBooleanEnv, castStringArrayEnv, castStringEnv } from '@config';

export const PROVIDERS = {
  get twitter() {
    return !castBooleanEnv('AUTH_PROVIDER_TWITTER_ENABLED')
      ? null
      : {
          get consumerKey() {
            return castStringEnv('AUTH_PROVIDER_TWITTER_CONSUMER_KEY');
          },
          get consumerSecret() {
            return castStringEnv('AUTH_PROVIDER_TWITTER_CONSUMER_SECRET');
          },
        };
  },

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

  get windowslive() {
    return !castBooleanEnv('AUTH_PROVIDER_WINDOWS_LIVE_ENABLED')
      ? null
      : {
          get clientID() {
            return castStringEnv('AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_ID');
          },
          get clientSecret() {
            return castStringEnv('AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_SECRET');
          },
          get scope() {
            return castStringArrayEnv('AUTH_PROVIDER_WINDOWS_LIVE_SCOPE', [
              'wl.basic',
              'wl.emails',
            ]);
          },
        };
  },

  get spotify() {
    return !castBooleanEnv('AUTH_PROVIDER_SPOTIFY_ENABLED')
      ? null
      : {
          get clientID() {
            return castStringEnv('AUTH_PROVIDER_SPOTIFY_CLIENT_ID');
          },
          get clientSecret() {
            return castStringEnv('AUTH_PROVIDER_SPOTIFY_CLIENT_SECRET');
          },
          get scope() {
            return castStringArrayEnv('AUTH_PROVIDER_SPOTIFY_SCOPE', [
              'user-read-email',
              'user-read-private',
            ]);
          },
        };
  },

  get twitch() {
    return !castBooleanEnv('AUTH_PROVIDER_TWITCH_ENABLED')
      ? null
      : {
          get clientID() {
            return castStringEnv('AUTH_PROVIDER_TWITCH_CLIENT_ID');
          },
          get clientSecret() {
            return castStringEnv('AUTH_PROVIDER_TWITCH_CLIENT_SECRET');
          },
          get scope() {
            return castStringArrayEnv('AUTH_PROVIDER_TWITCH_SCOPE', [
              'user:read:email',
            ]);
          },
        };
  },
};
