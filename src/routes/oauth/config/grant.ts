import { GrantConfig } from 'grant';

import { castBooleanEnv } from '@config';
import { ENV } from '@/utils';

export const OAUTH_ROUTE = '/signin/provider';
export const SESSION_NAME = 'connect.sid';

/**
 * Grant standard configuration
 */
const config: GrantConfig = {
  defaults: {
    origin: ENV.AUTH_SERVER_URL,
    prefix: OAUTH_ROUTE,
    transport: 'session',
    scope: ['email', 'profile'],
    response: ['tokens', 'email', 'profile', 'jwt'],
  },
};

if (castBooleanEnv('AUTH_PROVIDER_GITHUB_ENABLED')) {
  config.github = {
    client_id: process.env.AUTH_PROVIDER_GITHUB_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_GITHUB_CLIENT_SECRET,
    scope: ['user:email'],
  };
}

if (castBooleanEnv('AUTH_PROVIDER_GOOGLE_ENABLED')) {
  config.google = {
    client_id: process.env.AUTH_PROVIDER_GOOGLE_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_GOOGLE_CLIENT_SECRET,
    scope: ['email', 'profile'],
    custom_params: {
      // * do not re-promt the user for consent
      // prompt: 'consent',
      access_type: 'offline',
    },
  };
}

if (castBooleanEnv('AUTH_PROVIDER_WORKOS_ENABLED')) {
  config.workos = {
    oauth: 2,
    authorize_url: 'https://api.workos.com/sso/authorize',
    access_url: 'https://api.workos.com/sso/token',
    profile_url: 'https://api.workos.com/sso/profile',
    client_id: process.env.AUTH_PROVIDER_WORKOS_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_WORKOS_CLIENT_SECRET,
  };
}

if (castBooleanEnv('AUTH_PROVIDER_FACEBOOK_ENABLED')) {
  config.facebook = {
    client_id: process.env.AUTH_PROVIDER_FACEBOOK_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET,
    scope: ['email'],
    profile_url: 'https://graph.facebook.com/me?fields=id,name,email,picture',
  };
}

export { config };
