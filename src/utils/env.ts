import {
  castBooleanEnv,
  castIntEnv,
  castStringArrayEnv,
  castStringEnv,
} from '../config/utils';

export const ENV = {
  // jwt

  get JWT_SECRET() {
    return castStringEnv('JWT_SECRET', '');
  },
  get ALGORITHM() {
    return castStringEnv('JWT_ALGORITHM', 'HS512');
  },
  get CLAIMS_NAMESPACE() {
    return castStringEnv(
      'JWT_CLAIMS_NAMESPACE',
      'https://hasura.io/jwt/claims'
    );
  },
  get ACCESS_TOKEN_EXPIRES_IN() {
    return castIntEnv('ACCESS_TOKEN_EXPIRES_IN', 900);
  },
  get REFRESH_TOKEN_EXPIRES_IN() {
    return castIntEnv('REFRESH_TOKEN_EXPIRES_IN', 43200);
  },

  // Application

  get HASURA_GRAPHQL_ADMIN_SECRET() {
    return castStringEnv('HASURA_GRAPHQL_ADMIN_SECRET', '');
  },
  get HASURA_ENDPOINT() {
    return castStringEnv('HASURA_ENDPOINT', '');
  },

  get HOST() {
    return castStringEnv('HOST', undefined);
  },
  get PORT() {
    return castIntEnv('PORT', 3000);
  },

  get SMTP_PASS() {
    return castStringEnv('SMTP_PASS', '');
  },
  get SMTP_HOST() {
    return castStringEnv('SMTP_HOST', '');
  },
  get SMTP_USER() {
    return castStringEnv('SMTP_USER', '');
  },
  get SMTP_SENDER() {
    return castStringEnv('SMTP_SENDER', '');
  },
  get SMTP_AUTH_METHOD() {
    return castStringEnv('SMTP_AUTH_METHOD', 'PLAIN');
  },
  get EMAILS_ENABLED() {
    return castBooleanEnv('EMAILS_ENABLED', false);
  },
  get SMTP_PORT() {
    return castIntEnv('SMTP_PORT', 587);
  },
  get SMTP_SECURE() {
    // note: false disables SSL (deprecated)
    return castBooleanEnv('SMTP_SECURE', false);
  },

  get GRAVATAR_ENABLED() {
    return castBooleanEnv('GRAVATAR_ENABLED', true);
  },
  get GRAVATAR_DEFAULT() {
    return castStringEnv('GRAVATAR_DEFAULT', 'blank');
  },
  get GRAVATAR_RATING() {
    return castStringEnv('GRAVATAR_RATING', 'g');
  },

  get SERVER_URL() {
    return castStringEnv('SERVER_URL', '');
  },

  get APP_URL() {
    return castStringEnv('APP_URL', '');
  },

  get APP_NAME() {
    return castStringEnv('APP_NAME');
  },

  get DEFAULT_LOCALE() {
    return castStringEnv('DEFAULT_LOCALE', 'en');
  },

  get ALLOWED_LOCALES() {
    return castStringArrayEnv('ALLOWED_LOCALES') || ['en'];
  },

  get MAGIC_LINK_ENABLED() {
    return castBooleanEnv('MAGIC_LINK_ENABLED', false);
  },

  get MFA_ENABLED() {
    return castBooleanEnv('MFA_ENABLED', false);
  },

  get PHONE_NUMBER_AUTH_ENABLED() {
    return castBooleanEnv('PHONE_NUMBER_AUTH_ENABLED', false);
  },

  get DISABLE_NEW_USERS() {
    return castBooleanEnv('DISABLE_NEW_USERS', false);
  },

  get SIGNIN_EMAIL_VERIFIED_REQUIRED() {
    return castBooleanEnv('SIGNIN_EMAIL_VERIFIED_REQUIRED', true);
  },

  // get SIGNIN_PHONE_NUMBER_VERIFIED_REQUIRED() {
  //   return castBooleanEnv('SIGNIN_PHONE_NUMBER_VERIFIED_REQUIRED', true);
  // },

  get REGISTRATION_PROFILE_FIELDS() {
    return castStringArrayEnv('REGISTRATION_PROFILE_FIELDS', []);
  },

  get USER_SESSION_VARIABLE_FIELDS() {
    return castStringArrayEnv('USER_SESSION_VARIABLE_FIELDS', []);
  },

  get PROFILE_SESSION_VARIABLE_FIELDS() {
    return castStringArrayEnv('PROFILE_SESSION_VARIABLE_FIELDS', []);
  },

  get ANONYMOUS_USERS_ENABLED() {
    return castBooleanEnv('ANONYMOUS_USERS_ENABLED', false);
  },

  get DEFAULT_USER_ROLE() {
    return castStringEnv('DEFAULT_USER_ROLE', 'user');
  },

  get DEFAULT_ALLOWED_USER_ROLES() {
    return castStringArrayEnv('DEFAULT_ALLOWED_USER_ROLES', [
      this.DEFAULT_USER_ROLE,
    ]);
  },

  get ALLOWED_USER_ROLES() {
    return castStringArrayEnv(
      'ALLOWED_USER_ROLES',
      this.DEFAULT_ALLOWED_USER_ROLES
    );
  },

  get MIN_PASSWORD_LENGTH() {
    return castIntEnv('MIN_PASSWORD_LENGTH', 3);
  },

  get HIBP_ENABLED() {
    return castBooleanEnv('HIBP_ENABLED', false);
  },

  get WHITELIST_ENABLED() {
    return castBooleanEnv('WHITELIST_ENABLED', false);
  },

  get ALLOWED_EMAIL_DOMAINS() {
    return castStringArrayEnv('ALLOWED_EMAIL_DOMAINS');
  },

  get ALLOWED_REDIRECT_URLS() {
    return castStringArrayEnv('ALLOWED_REDIRECT_URLS');
  },

  get LOGGER_ENABLED() {
    return castBooleanEnv('LOGGER_ENABLED', true);
  },

  get LOGGER_LEVEL() {
    return castStringEnv('LOGGER_LEVEL', 'info');
  },

  get TOTP_ISSUER() {
    return castStringEnv('TOTP_ISSUER', 'hasura-auth');
  },
};
