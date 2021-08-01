import {
  castBooleanEnv,
  castIntEnv,
  castStringArrayEnv,
  castStringEnv,
} from '../config/utils';

export const ENV = {
  get DEFAULT_LOCALE() {
    return castStringEnv('DEFAULT_LOCALE', 'en');
  },

  get ALLOWED_LOCALES() {
    return castStringArrayEnv('ALLOWED_LOCALES') || ['en'];
  },

  get REGISTRATION_PROFILE_FIELDS() {
    return castStringArrayEnv('REGISTRATION_PROFILE_FIELDS', []);
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
