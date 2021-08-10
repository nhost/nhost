import {
  castBooleanEnv,
  castIntEnv,
  castStringArrayEnv,
  castStringEnv,
} from '../config/utils';

export const ENV = {
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
};
