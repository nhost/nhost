import { logger } from '@/logger';
import { JwtSecret } from '@/types';
import {
  castBooleanEnv,
  castIntEnv,
  castObjectEnv,
  castStringArrayEnv,
  castStringEnv,
} from '../config/utils';

export const ENV = {
  get PWD() {
    return castStringEnv('PWD', '/');
  },

  // HASURA
  get HASURA_GRAPHQL_JWT_SECRET() {
    return castObjectEnv<JwtSecret>('HASURA_GRAPHQL_JWT_SECRET');
  },
  get HASURA_GRAPHQL_DATABASE_URL() {
    return castStringEnv('HASURA_GRAPHQL_DATABASE_URL');
  },
  get HASURA_GRAPHQL_ADMIN_SECRET() {
    return castStringEnv('HASURA_GRAPHQL_ADMIN_SECRET');
  },
  get HASURA_GRAPHQL_GRAPHQL_URL() {
    return castStringEnv('HASURA_GRAPHQL_GRAPHQL_URL');
  },

  // SERVER
  get AUTH_PORT() {
    return castIntEnv('AUTH_PORT', 4000);
  },
  get AUTH_SERVER_URL() {
    return castStringEnv('AUTH_SERVER_URL');
  },
  get AUTH_API_PREFIX() {
    return castStringEnv('AUTH_API_PREFIX', '');
  },

  // SMTP
  get AUTH_SMTP_PASS() {
    return castStringEnv('AUTH_SMTP_PASS');
  },
  get AUTH_SMTP_HOST() {
    return castStringEnv('AUTH_SMTP_HOST');
  },
  get AUTH_SMTP_USER() {
    return castStringEnv('AUTH_SMTP_USER');
  },
  get AUTH_SMTP_SENDER() {
    return castStringEnv('AUTH_SMTP_SENDER');
  },
  get AUTH_SMTP_AUTH_METHOD() {
    return castStringEnv('AUTH_SMTP_AUTH_METHOD', 'PLAIN');
  },
  get AUTH_SMTP_PORT() {
    return castIntEnv('AUTH_SMTP_PORT', 587);
  },
  get AUTH_SMTP_SECURE() {
    // note: false disables SSL (deprecated)
    return castBooleanEnv('AUTH_SMTP_SECURE', false);
  },
  get AUTH_SMTP_X_SMTPAPI_HEADER() {
    return castStringEnv('AUTH_SMTP_X_SMTPAPI_HEADER');
  },

  // SMS
  get AUTH_SMS_PROVIDER() {
    return castStringEnv('AUTH_SMS_PROVIDER');
  },
  get AUTH_SMS_TEST_PHONE_NUMBERS() {
    return castStringArrayEnv('AUTH_SMS_TEST_PHONE_NUMBERS', []);
  },

  // TWILIO
  get AUTH_SMS_TWILIO_ACCOUNT_SID() {
    return castStringEnv('AUTH_SMS_TWILIO_ACCOUNT_SID');
  },
  get AUTH_SMS_TWILIO_AUTH_TOKEN() {
    return castStringEnv('AUTH_SMS_TWILIO_AUTH_TOKEN');
  },
  get AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID() {
    return castStringEnv('AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID');
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

  // CLIENT
  get AUTH_CLIENT_URL() {
    return castStringEnv('AUTH_CLIENT_URL').toLocaleLowerCase();
  },

  // WEBAUTHN
  get AUTH_WEBAUTHN_ENABLED() {
    return castBooleanEnv('AUTH_WEBAUTHN_ENABLED', false);
  },
  get AUTH_WEBAUTHN_RP_NAME() {
    return castStringEnv('AUTH_WEBAUTHN_RP_NAME', '');
  },
  get AUTH_WEBAUTHN_RP_ID() {
    return castStringEnv('AUTH_WEBAUTHN_RP_ID', '');
  },
  get AUTH_WEBAUTHN_RP_ORIGINS() {
    const origins = castStringArrayEnv('AUTH_WEBAUTHN_RP_ORIGINS', []);
    const clientUrl = ENV.AUTH_CLIENT_URL;
    if (clientUrl) {
      origins.push(clientUrl);
    }
    return origins.filter(Boolean);
  },
  get AUTH_WEBAUTHN_ATTESTATION_TIMEOUT() {
    return castIntEnv('AUTH_WEBAUTHN_ATTESTATION_TIMEOUT', 60000);
  },

  // SIGN UP
  get AUTH_ANONYMOUS_USERS_ENABLED() {
    return castBooleanEnv('AUTH_ANONYMOUS_USERS_ENABLED', false);
  },
  get AUTH_DISABLE_NEW_USERS() {
    return castBooleanEnv('AUTH_DISABLE_NEW_USERS', false);
  },
  get AUTH_ACCESS_CONTROL_ALLOWED_EMAILS() {
    return castStringArrayEnv('AUTH_ACCESS_CONTROL_ALLOWED_EMAILS', []);
  },
  get AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS() {
    return castStringArrayEnv('AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS', []);
  },
  get AUTH_ACCESS_CONTROL_BLOCKED_EMAILS() {
    return castStringArrayEnv('AUTH_ACCESS_CONTROL_BLOCKED_EMAILS', []);
  },
  get AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS() {
    return castStringArrayEnv('AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS', []);
  },
  get AUTH_PASSWORD_MIN_LENGTH() {
    return castIntEnv('AUTH_PASSWORD_MIN_LENGTH', 3);
  },
  get AUTH_PASSWORD_HIBP_ENABLED() {
    return castBooleanEnv('AUTH_PASSWORD_HIBP_ENABLED', false);
  },
  get AUTH_USER_DEFAULT_ROLE() {
    return castStringEnv('AUTH_USER_DEFAULT_ROLE', 'user');
  },
  get AUTH_USER_DEFAULT_ALLOWED_ROLES() {
    const allowedRoles = [
      'me',
      this.AUTH_USER_DEFAULT_ROLE,
      ...castStringArrayEnv('AUTH_USER_DEFAULT_ALLOWED_ROLES'),
    ];
    // remove duplicates
    return [...new Set(allowedRoles)];
  },
  get AUTH_LOCALE_DEFAULT() {
    return castStringEnv('AUTH_LOCALE_DEFAULT', 'en');
  },
  get AUTH_LOCALE_ALLOWED_LOCALES() {
    const locales = [
      ENV.AUTH_LOCALE_DEFAULT,
      ...castStringArrayEnv('AUTH_LOCALE_ALLOWED_LOCALES'),
    ];
    // remove duplicates
    return [...new Set(locales)];
  },

  // SIGN IN
  get AUTH_EMAIL_PASSWORDLESS_ENABLED() {
    return castBooleanEnv('AUTH_EMAIL_PASSWORDLESS_ENABLED', false);
  },
  get AUTH_SMS_PASSWORDLESS_ENABLED() {
    return castBooleanEnv('AUTH_SMS_PASSWORDLESS_ENABLED', false);
  },
  get AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED() {
    return castBooleanEnv('AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED', true);
  },
  // get AUTH_SIGNIN_PHONE_NUMBER_VERIFIED_REQUIRED() {
  //   return castBooleanEnv('AUTH_SIGNIN_PHONE_NUMBER_VERIFIED_REQUIRED', true);
  // },
  get AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS() {
    return castStringArrayEnv('AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS').map(
      (v) => v.toLowerCase()
    );
  },
  get AUTH_MFA_ENABLED() {
    return castBooleanEnv('AUTH_MFA_ENABLED', false);
  },
  get AUTH_MFA_TOTP_ISSUER() {
    return castStringEnv('AUTH_MFA_TOTP_ISSUER', 'hasura-auth');
  },

  // TOKENS
  get AUTH_ACCESS_TOKEN_EXPIRES_IN() {
    return castIntEnv('AUTH_ACCESS_TOKEN_EXPIRES_IN', 900);
  },
  get AUTH_REFRESH_TOKEN_EXPIRES_IN() {
    return castIntEnv('AUTH_REFRESH_TOKEN_EXPIRES_IN', 2_592_000);
  },

  // EMAIL TEMPLATES
  get AUTH_EMAIL_TEMPLATE_FETCH_URL() {
    return castStringEnv('AUTH_EMAIL_TEMPLATE_FETCH_URL');
  },

  get AUTH_JWT_CUSTOM_CLAIMS() {
    try {
      return castObjectEnv<Record<string, string>>('AUTH_JWT_CUSTOM_CLAIMS');
    } catch {
      logger.warn(
        'AUTH_JWT_CUSTOM_CLAIMS cannot be parsed. Will ignore custom claims.'
      );
      return {};
    }
  },

  get AUTH_USER_SESSION_VARIABLE_FIELDS(): Record<string, string> {
    return this.AUTH_USER_SESSION_VARIABLE_FIELDS;
  },

  get AUTH_CONCEAL_ERRORS() {
    return castBooleanEnv('AUTH_CONCEAL_ERRORS', false);
  },

  get AUTH_SHOW_LOG_QUERY_PARAMS() {
    return castBooleanEnv('AUTH_SHOW_LOG_QUERY_PARAMS', false);
  },

  get AUTH_DISABLE_SIGNUP() {
    return castBooleanEnv('AUTH_DISABLE_SIGNUP', false);
  },

  // * See ../server.ts
  // get AUTH_SKIP_INIT() {
  //   return castBooleanEnv('AUTH_SKIP_INIT', false);
  // },
  // get AUTH_SKIP_SERVE() {
  //   return castBooleanEnv('AUTH_SKIP_SERVE', false);
  // },
};
