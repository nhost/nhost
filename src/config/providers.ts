import { castBooleanEnv, castStringArrayEnv } from '@config/utils';

const PROVIDERS = {
  get REDIRECT_SUCCESS() {
    return process.env.PROVIDER_SUCCESS_REDIRECT;
  },
  get REDIRECT_FAILURE() {
    return process.env.PROVIDER_FAILURE_REDIRECT;
  },

  get github() {
    return !(
      castBooleanEnv('GITHUB_ENABLED') || castBooleanEnv('GITHUB_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.GITHUB_CLIENT_ID;
          },
          get clientSecret() {
            return process.env.GITHUB_CLIENT_SECRET;
          },
          get authorizationURL() {
            return process.env.GITHUB_AUTHORIZATION_URL;
          },
          get tokenURL() {
            return process.env.GITHUB_TOKEN_URL;
          },
          get userProfileURL() {
            return process.env.GITHUB_USER_PROFILE_URL;
          },
          get scope() {
            return castStringArrayEnv('GITHUB_SCOPE', ['user:email']);
          },
        };
  },

  get google() {
    return !(
      castBooleanEnv('GOOGLE_ENABLED') || castBooleanEnv('GOOGLE_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.GOOGLE_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.GOOGLE_CLIENT_SECRET || '';
          },
          get scope() {
            return castStringArrayEnv('GOOGLE_SCOPE', ['email', 'profile']);
          },
        };
  },

  get facebook() {
    return !(
      castBooleanEnv('FACEBOOK_ENABLED') || castBooleanEnv('FACEBOOK_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.FACEBOOK_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.FACEBOOK_CLIENT_SECRET || '';
          },
          get profileFields() {
            return castStringArrayEnv('FACEBOOK_PROFILE_FIELDS', [
              'email',
              'photos',
              'displayName',
            ]);
          },
        };
  },

  get twitter() {
    return !(
      castBooleanEnv('TWITTER_ENABLED') || castBooleanEnv('TWITTER_ENABLE')
    )
      ? null
      : {
          get consumerKey() {
            return process.env.TWITTER_CONSUMER_KEY || '';
          },
          get consumerSecret() {
            return process.env.TWITTER_CONSUMER_SECRET || '';
          },
        };
  },

  get linkedin() {
    return !(
      castBooleanEnv('LINKEDIN_ENABLED') || castBooleanEnv('LINKEDIN_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.LINKEDIN_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.LINKEDIN_CLIENT_SECRET || '';
          },
          get scope() {
            return castStringArrayEnv('LINKEDIN_SCOPE', [
              'r_emailaddress',
              'r_liteprofile',
            ]);
          },
        };
  },

  get apple() {
    if (!(castBooleanEnv('APPLE_ENABLED') || castBooleanEnv('APPLE_ENABLE')))
      return null;
    try {
      return {
        get clientID() {
          return process.env.APPLE_CLIENT_ID || '';
        },
        get teamID() {
          return process.env.APPLE_TEAM_ID || '';
        },
        get keyID() {
          return process.env.APPLE_KEY_ID || '';
        },
        get key() {
          return (
            (process.env.APPLE_PRIVATE_KEY &&
              // Convert contents from base64 string to string to avoid issues with line breaks in the environment variable
              Buffer.from(process.env.APPLE_PRIVATE_KEY, 'base64').toString(
                'ascii'
              )) ||
            ''
          );
        },
        get scope() {
          return castStringArrayEnv('APPLE_SCOPE', ['name', 'email']);
        },
      };
    } catch (e) {
      throw new Error(`Invalid Apple OAuth Key file`);
    }
  },

  get windowslive() {
    return !(
      castBooleanEnv('WINDOWS_LIVE_ENABLED') ||
      castBooleanEnv('WINDOWS_LIVE_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.WINDOWS_LIVE_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.WINDOWS_LIVE_CLIENT_SECRET || '';
          },
          get scope() {
            return castStringArrayEnv('WINDOWS_LIVE_SCOPE', [
              'wl.basic',
              'wl.emails',
            ]);
          },
        };
  },

  get spotify() {
    return !(
      castBooleanEnv('SPOTIFY_ENABLED') || castBooleanEnv('SPOTIFY_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.SPOTIFY_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.SPOTIFY_CLIENT_SECRET || '';
          },
          get scope() {
            return castStringArrayEnv('SPOTIFY_SCOPE', [
              'user-read-email',
              'user-read-private',
            ]);
          },
        };
  },

  get gitlab() {
    return !(
      castBooleanEnv('GITLAB_ENABLED') || castBooleanEnv('GITLAB_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.GITLAB_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.GITLAB_CLIENT_SECRET || '';
          },
          get baseUrl() {
            return process.env.GITLAB_BASE_URL || '';
          },
          get scope() {
            return castStringArrayEnv('GITLAB_SCOPE', ['read_user']);
          },
        };
  },

  get bitbucket() {
    return !(
      castBooleanEnv('BITBUCKET_ENABLED') || castBooleanEnv('BITBUCKET_ENABLE')
    )
      ? null
      : {
          get clientID() {
            return process.env.BITBUCKET_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.BITBUCKET_CLIENT_SECRET || '';
          },
        };
  },

  get strava() {
    return !castBooleanEnv('STRAVA_ENABLED')
      ? null
      : {
          get clientID() {
            return process.env.STRAVA_CLIENT_ID || '';
          },
          get clientSecret() {
            return process.env.STRAVA_CLIENT_SECRET || '';
          },
          get scope() {
            return castStringArrayEnv('STRAVA_SCOPE', ['profile:read_all']);
          },
        };
  },
};

export { PROVIDERS };
