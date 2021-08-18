import {
  castBooleanEnv,
  castIntEnv,
  castStringArrayEnv,
  castStringEnv,
} from '../config/utils';

export const ENV = {
  get PWD() {
    return castStringEnv('PWD', '/');
  },

  // HASURA
  get HASURA_GRAPHQL_JWT_SECRET() {
    return castStringEnv('HASURA_GRAPHQL_JWT_SECRET', '');
  },
  get HASURA_GRAPHQL_DATABASE_URL() {
    return castStringEnv('HASURA_GRAPHQL_DATABASE_URL', '');
  },
  get HASURA_GRAPHQL_ADMIN_SECRET() {
    return castStringEnv('HASURA_GRAPHQL_ADMIN_SECRET', '');
  },
  get HASURA_ENDPOINT() {
    return castStringEnv('HASURA_GRAPHQL_GRAPHQL_URL', '');
  },

  // SERVER
  get AUTH_HOST() {
    return castStringEnv('AUTH_HOST', undefined);
  },
  get AUTH_PORT() {
    return castIntEnv('AUTH_PORT', 4000);
  },
  get AUTH_SERVER_URL() {
    return castStringEnv('AUTH_SERVER_URL', '');
  },

  // SMTP
  get AUTH_SMTP_PASS() {
    return castStringEnv('AUTH_SMTP_PASS', '');
  },
  get AUTH_SMTP_HOST() {
    return castStringEnv('AUTH_SMTP_HOST', '');
  },
  get AUTH_SMTP_USER() {
    return castStringEnv('AUTH_SMTP_USER', '');
  },
  get AUTH_SMTP_SENDER() {
    return castStringEnv('AUTH_SMTP_SENDER', '');
  },
  get AUTH_SMTP_AUTH_METHOD() {
    return castStringEnv('AUTH_SMTP_AUTH_METHOD', 'PLAIN');
  },
  get AUTH_EMAILS_ENABLED() {
    return castBooleanEnv('AUTH_EMAILS_ENABLED', false);
  },
  get AUTH_SMTP_PORT() {
    return castIntEnv('AUTH_SMTP_PORT', 587);
  },
  get AUTH_SMTP_SECURE() {
    // note: false disables SSL (deprecated)
    return castBooleanEnv('AUTH_SMTP_SECURE', false);
  },

  // GRAVATAR
  get AUTH_GRAVATAR_ENABLED() {
    return castBooleanEnv('AUTH_GRAVATAR_ENABLED', true);
  },
  get AUTH_GRAVATAR_DEFAULT() {
    return castStringEnv('AUTH_GRAVATAR_DEFAULT', 'blank');
  },
  get AUTH_GRAVATAR_RATING() {
    return castStringEnv('AUTH_GRAVATAR_RATING', 'g');
  },

  // CLIENT & APP
  get AUTH_CLIENT_URL() {
    return castStringEnv('AUTH_CLIENT_URL', '');
  },
  get AUTH_APP_NAME() {
    return castStringEnv('AUTH_APP_NAME');
  },

  // SIGN UP
  get AUTH_ANONYMOUS_USERS_ENABLED() {
    return castBooleanEnv('AUTH_ANONYMOUS_USERS_ENABLED', false);
  },
  get AUTH_DISABLE_NEW_USERS() {
    return castBooleanEnv('AUTH_DISABLE_NEW_USERS', false);
  },
  get AUTH_WHITELIST_ENABLED() {
    return castBooleanEnv('AUTH_WHITELIST_ENABLED', false);
  },
  get AUTH_ALLOWED_EMAIL_DOMAINS() {
    return castStringArrayEnv('AUTH_ALLOWED_EMAIL_DOMAINS');
  },
  get AUTH_SIGNUP_PROFILE_FIELDS() {
    return castStringArrayEnv('AUTH_SIGNUP_PROFILE_FIELDS', []);
  },
  get AUTH_MIN_PASSWORD_LENGTH() {
    return castIntEnv('AUTH_MIN_PASSWORD_LENGTH', 3);
  },
  get AUTH_HIBP_ENABLED() {
    return castBooleanEnv('AUTH_HIBP_ENABLED', false);
  },
  get AUTH_DEFAULT_USER_ROLE() {
    return castStringEnv('AUTH_DEFAULT_USER_ROLE', 'user');
  },
  get AUTH_DEFAULT_ALLOWED_USER_ROLES() {
    return castStringArrayEnv('AUTH_DEFAULT_ALLOWED_USER_ROLES', [
      this.AUTH_DEFAULT_USER_ROLE,
    ]);
  },
  get AUTH_ALLOWED_USER_ROLES() {
    return castStringArrayEnv(
      'ALLOWED_USER_ROLES',
      this.AUTH_DEFAULT_ALLOWED_USER_ROLES
    );
  },
  get AUTH_DEFAULT_LOCALE() {
    return castStringEnv('AUTH_DEFAULT_LOCALE', 'en');
  },
  get AUTH_ALLOWED_LOCALES() {
    return castStringArrayEnv('AUTH_ALLOWED_LOCALES') || ['en'];
  },

  // SIGN IN
  get AUTH_PASSWORDLESS_EMAIL_ENABLED() {
    return castBooleanEnv('AUTH_PASSWORDLESS_EMAIL_ENABLED', false);
  },
  get AUTH_PASSWORDLESS_SMS_ENABLED() {
    return castBooleanEnv('AUTH_PASSWORDLESS_SMS_ENABLED', false);
  },
  get AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED() {
    return castBooleanEnv('AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED', true);
  },
  // get AUTH_SIGNIN_PHONE_NUMBER_VERIFIED_REQUIRED() {
  //   return castBooleanEnv('AUTH_SIGNIN_PHONE_NUMBER_VERIFIED_REQUIRED', true);
  // },
  get AUTH_ALLOWED_REDIRECT_URLS() {
    return castStringArrayEnv('AUTH_ALLOWED_REDIRECT_URLS');
  },
  get AUTH_MFA_ENABLED() {
    return castBooleanEnv('AUTH_MFA_ENABLED', false);
  },
  get AUTH_TOTP_ISSUER() {
    return castStringEnv('AUTH_TOTP_ISSUER', 'hasura-auth');
  },

  // TOKENS
  get AUTH_ACCESS_TOKEN_EXPIRES_IN() {
    return castIntEnv('AUTH_ACCESS_TOKEN_EXPIRES_IN', 900);
  },
  get AUTH_REFRESH_TOKEN_EXPIRES_IN() {
    return castIntEnv('AUTH_REFRESH_TOKEN_EXPIRES_IN', 43200);
  },
  get AUTH_USER_SESSION_VARIABLE_FIELDS() {
    return castStringArrayEnv('AUTH_USER_SESSION_VARIABLE_FIELDS', []);
  },
  get AUTH_PROFILE_SESSION_VARIABLE_FIELDS() {
    return castStringArrayEnv('AUTH_PROFILE_SESSION_VARIABLE_FIELDS', []);
  },

  // EMAIL TEMPLATES
  get AUTH_EMAIL_TEMPLATE_FETCH_URL() {
    return castStringEnv('AUTH_EMAIL_TEMPLATE_FETCH_URL', '');
  },

  // LOGS
  get AUTH_LOG_LEVEL() {
    return castStringEnv('AUTH_LOG_LEVEL', 'info');
  },
};
