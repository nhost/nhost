import { sendError } from '@/errors';
import axios from 'axios';
import { RequestHandler } from 'express';
import { GrantProvider, GrantResponse } from 'grant';
import jwt from 'jsonwebtoken';
import { NormalisedProfile } from './utils';
export const OAUTH_ROUTE = '/signin/provider';
import { logger } from '@/logger';

const azureBaseUrl = 'https://login.microsoftonline.com';
const workosBaseUrl = 'https://api.workos.com/sso';
process.env.DEBUG = 'req,res,json';
export const PROVIDERS_CONFIG: Record<
  string,
  {
    grant: GrantProvider;
    profile: (
      response: GrantResponse
    ) => Promise<NormalisedProfile> | NormalisedProfile;
    middleware?: RequestHandler;
  }
> = {
  apple: {
    grant: {
      // * See https://github.com/simov/grant/issues/193
      key: process.env.AUTH_PROVIDER_APPLE_CLIENT_ID, //  Apple service id is the client id
      secret:
        process.env.AUTH_PROVIDER_APPLE_CLIENT_ID &&
        process.env.AUTH_PROVIDER_APPLE_TEAM_ID &&
        process.env.AUTH_PROVIDER_APPLE_KEY_ID &&
        process.env.AUTH_PROVIDER_APPLE_PRIVATE_KEY &&
        jwt.sign(
          {
            iss: process.env.AUTH_PROVIDER_APPLE_TEAM_ID,
            aud: 'https://appleid.apple.com',
            sub: process.env.AUTH_PROVIDER_APPLE_CLIENT_ID,
          },
          process.env.AUTH_PROVIDER_APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          {
            algorithm: 'ES256',
            header: {
              kid: process.env.AUTH_PROVIDER_APPLE_KEY_ID,
              typ: undefined,
              alg: 'ES256',
            },
            expiresIn: '180d',
          }
        ),
      scope: ['name', 'email'],
      custom_params: {
        response_type: 'code id_token',
        response_mode: 'form_post',
      },
      dynamic: [],
    },
    profile: ({ jwt, profile }) => {
      const payload = jwt?.id_token?.payload;

      let displayName;

      if (profile) {
        try {
          const userProfile = JSON.parse(profile);

          displayName = userProfile.name
            ? `${userProfile.name.firstName} ${userProfile.name.lastName}`
            : displayName;
        } catch (error) {
          logger.warn(
            `Problem trying to parse user data from Apple's response: ${error}. Using the user's email as a fallback.`
          );

          // use the user's email as fallback
          displayName = payload.email;
        }
      }

      return {
        id: payload.sub,
        displayName,
        email: payload.email,
        emailVerified: payload.email_verified === 'true',
      };
    },
  },

  azuread: {
    grant: {
      oauth: 2,
      scope_delimiter: ' ',
      client_id: process.env.AUTH_PROVIDER_AZUREAD_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_AZUREAD_CLIENT_SECRET,
      authorize_url: `${azureBaseUrl}/[subdomain]/oauth2/authorize`,
      custom_params: {
        prompt: 'select_account',
      },
      access_url: `${azureBaseUrl}/[subdomain]/oauth2/token`,
      profile_url: `${azureBaseUrl}/[subdomain]/openid/userinfo`,
      subdomain: process.env.AUTH_PROVIDER_AZUREAD_TENANT || 'common',
      dynamic: [],
    },
    profile: ({ jwt }) => {
      const payload = jwt?.id_token?.payload;
      return {
        id: payload.oid,
        displayName: payload.name,
        email: payload.email,
      };
    },
  },

  bitbucket: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_BITBUCKET_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_BITBUCKET_CLIENT_SECRET,
      scope: ['account'],
      dynamic: [],
    },
    profile: async ({ profile, access_token }) => {
      const {
        data: {
          values: [{ email, is_confirmed }],
        },
      } = await axios.get<{
        values: { email: string; is_confirmed: boolean }[];
      }>(`https://api.bitbucket.org/2.0/user/emails`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      return {
        id: profile.uuid,
        displayName: profile.display_name,
        emailVerified: is_confirmed,
        email,
        avatarUrl: profile.links.avatar.href,
      };
    },
  },

  discord: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_DISCORD_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_DISCORD_CLIENT_SECRET,
      scope: ['identify', 'email'],
      dynamic: [],
    },
    profile: ({ profile }) => ({
      id: profile.id,
      displayName: `${profile.username}#${profile.discriminator}`,
      emailVerified: !!profile.verified,
      email: profile.email,
      locale: profile.locale?.slice(0, 2),
      avatarUrl: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
    }),
  },

  facebook: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_FACEBOOK_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET,
      scope: ['email'],
      profile_url: 'https://graph.facebook.com/me?fields=id,name,email,picture',
      dynamic: [],
    },
    profile: ({ profile }) => ({
      id: profile.id,
      displayName: profile.name,
      email: profile.email,
      avatarUrl: profile.picture?.data?.url,
    }),
  },

  github: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_GITHUB_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_GITHUB_CLIENT_SECRET,
      scope: ['user:email'],
      dynamic: [],
    },
    profile: async ({ profile, access_token }) => {
      // * The email is not returned by default, so we need to make a separate request
      const { data: emails } = await axios.get<
        { email: string; primary: boolean; verified: boolean }[]
      >('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const { email, verified } =
        emails.find((email) => email.primary) || emails[0];
      return {
        id: profile.id && String(profile.id),
        displayName: profile.name,
        avatarUrl: profile.avatar_url,
        email,
        emailVerified: verified,
      };
    },
  },

  gitlab: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_GITLAB_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_GITLAB_CLIENT_SECRET,
      scope: ['read_user'],
      dynamic: [],
    },
    profile: ({ profile }) => ({
      id: profile.id && String(profile.id),
      displayName: profile.name,
      email: profile.email,
      avatarUrl: profile.avatar_url,
    }),
  },

  google: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_GOOGLE_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_GOOGLE_CLIENT_SECRET,
      scope: ['email', 'profile'],
      custom_params: {
        prompt: 'consent',
        access_type: 'offline',
      },
      dynamic: [],
    },
    profile: ({
      profile: { sub, name, picture, email, email_verified, locale },
    }) => ({
      id: sub,
      displayName: name,
      avatarUrl: picture,
      email,
      emailVerified: email_verified,
      locale: locale?.slice(0, 2),
    }),
  },

  linkedin: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_LINKEDIN_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_LINKEDIN_CLIENT_SECRET,
      scope: ['openid', 'profile', 'email'],
      profile_url: 'https://api.linkedin.com/v2/userinfo',
      dynamic: [],
    },
    profile: async ({ profile }) => {
      const displayName =
        profile && profile.given_name && profile.family_name
          ? `${profile.given_name} ${profile.family_name}`
          : profile.email;

      return {
        id: profile.sub,
        displayName,
        avatarUrl: profile.picture,
        locale: profile.locale,
        email: profile.email,
      };
    },
  },

  spotify: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_SPOTIFY_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_SPOTIFY_CLIENT_SECRET,
      scope: ['user-read-email', 'user-read-private'],
      dynamic: [],
    },
    profile: ({ profile }) => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      avatarUrl: profile.images?.[0]?.url,
    }),
  },

  strava: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_STRAVA_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_STRAVA_CLIENT_SECRET,
      scope: ['profile:read_all'],
      dynamic: [],
    },
    // ! It is not possible to get the user's email address from Strava
    profile: ({ profile }) => {
      return {
        id: profile.id && String(profile.id),
        displayName: `${profile.firstname} ${profile.lastname}`,
        avatarUrl: profile.profile,
      };
    },
  },

  twitch: {
    grant: {
      client_id: process.env.AUTH_PROVIDER_TWITCH_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_TWITCH_CLIENT_SECRET,
      scope: ['user:read:email'],
      dynamic: [],
    },
    profile: ({ profile: { data } }) => {
      if (!Array.isArray(data)) {
        return {
          id: null,
          email: null,
          displayName: null,
          avatarUrl: null,
        };
      }

      const [profile] = data;

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url,
      };
    },
  },

  twitter: {
    grant: {
      key: process.env.AUTH_PROVIDER_TWITTER_CONSUMER_KEY,
      secret: process.env.AUTH_PROVIDER_TWITTER_CONSUMER_SECRET,
      response: ['tokens', 'profile', 'raw'],
      profile_url:
        'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true',
      dynamic: [],
    },
    profile: ({ profile }) => ({
      id: profile.id_str || (profile.id && String(profile.id)),
      displayName: profile.name,
      email: profile.email,
      avatarUrl: profile.profile_image_url_https,
    }),
  },

  windowslive: {
    // * Copy of Grant's `live` provider
    grant: {
      oauth: 2,
      authorize_url: 'https://login.live.com/oauth20_authorize.srf',
      access_url: 'https://login.live.com/oauth20_token.srf',
      profile_url: 'https://apis.live.net/v5.0/me',
      client_id: process.env.AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_SECRET,
      scope: ['wl.basic', 'wl.emails'],
      dynamic: [],
    },
    profile: ({ profile }) => ({
      // ? Could be improved in fetching the user's profile picture - but the apis.live.net/v5.0 API is deprecated
      id: profile.id,
      email: profile.emails.preferred || profile.emails.account,
      displayName: profile.name,
      avatarUrl: profile.profile_image_url,
    }),
  },

  workos: {
    grant: {
      oauth: 2,
      authorize_url: `${workosBaseUrl}/authorize`,
      access_url: `${workosBaseUrl}/token`,
      profile_url: `${workosBaseUrl}/profile`,
      client_id: process.env.AUTH_PROVIDER_WORKOS_CLIENT_ID,
      client_secret: process.env.AUTH_PROVIDER_WORKOS_CLIENT_SECRET,
      dynamic: ['custom_params'],
    },
    profile: ({ profile: { raw_attributes, id, email } }) => ({
      id,
      displayName:
        raw_attributes?.[
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
        ],
      avatarUrl: raw_attributes?.['http://schemas.auth0.com/picture'],
      email,
      locale: raw_attributes?.['http://schemas.auth0.com/locale']?.slice(0, 2),
    }),
    middleware: (
      {
        query: {
          organization = process.env.AUTH_PROVIDER_WORKOS_DEFAULT_ORGANIZATION,
          connection = process.env.AUTH_PROVIDER_WORKOS_DEFAULT_CONNECTION,
          domain = process.env.AUTH_PROVIDER_WORKOKS_DEFAULT_DOMAIN,
        },
      },
      res,
      next
    ) => {
      if (!(organization || connection || domain)) {
        return sendError(res, 'invalid-request', {
          customMessage:
            'You need to give either an organization, a domain or a connection to be able to authenticate with WorkOS',
          redirectTo: res.locals.redirectTo,
        });
      }
      res.locals.grant = {
        dynamic: {
          custom_params: { organization, connection, domain },
        },
      };
      next();
    },
  },
};
