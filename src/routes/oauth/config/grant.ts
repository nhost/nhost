import { GrantConfig } from 'grant';

import { castBooleanEnv } from '@config';
import { ENV } from '@/utils';

export const OAUTH_ROUTE = '/signin/provider';
export const SESSION_NAME = 'connect.sid';

/**
 * Grant standard configuration
 */
const GRANT_CONFIG: GrantConfig = {
  defaults: {
    origin: ENV.AUTH_SERVER_URL,
    prefix: OAUTH_ROUTE,
    transport: 'session',
    scope: ['email', 'profile'],
    response: ['tokens', 'email', 'profile', 'jwt'],
  },
};

if (castBooleanEnv('AUTH_PROVIDER_AZUREAD_ENABLED')) {
  const baseUrl = 'https://login.microsoftonline.com';
  GRANT_CONFIG.azuread = {
    oauth: 2,
    scope_delimiter: ' ',
    client_id: process.env.AUTH_PROVIDER_AZUREAD_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_AZUREAD_CLIENT_SECRET,
    authorize_url: `${baseUrl}/[subdomain]/oauth2/authorize`,
    access_url: `${baseUrl}/[subdomain]/oauth2/token`,
    profile_url: `${baseUrl}/[subdomain]/openid/userinfo`,
    subdomain: process.env.AUTH_PROVIDER_AZUREAD_TENANT || 'common',
  };
}

if (castBooleanEnv('AUTH_PROVIDER_FACEBOOK_ENABLED')) {
  GRANT_CONFIG.facebook = {
    client_id: process.env.AUTH_PROVIDER_FACEBOOK_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET,
    scope: ['email'],
    profile_url: 'https://graph.facebook.com/me?fields=id,name,email,picture',
  };
}

if (castBooleanEnv('AUTH_PROVIDER_GITHUB_ENABLED')) {
  GRANT_CONFIG.github = {
    client_id: process.env.AUTH_PROVIDER_GITHUB_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_GITHUB_CLIENT_SECRET,
    scope: ['user:email'],
  };
}

if (castBooleanEnv('AUTH_PROVIDER_GOOGLE_ENABLED')) {
  GRANT_CONFIG.google = {
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
  const baseUrl = 'https://api.workos.com/sso';
  GRANT_CONFIG.workos = {
    oauth: 2,
    authorize_url: `${baseUrl}/authorize`,
    access_url: `${baseUrl}/token`,
    profile_url: `${baseUrl}/profile`,
    client_id: process.env.AUTH_PROVIDER_WORKOS_CLIENT_ID,
    client_secret: process.env.AUTH_PROVIDER_WORKOS_CLIENT_SECRET,
  };
}

export { GRANT_CONFIG };
