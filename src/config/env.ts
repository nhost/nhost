import { castBooleanEnv, castStringArrayEnv } from './utils';

export const ENV = {
  get DEFAULT_LOCALE() {
    return process.env.DEFAULT_LOCALE || 'en';
  },

  get ALLOWED_LOCALES() {
    return castStringArrayEnv('ALLOWED_LOCALES') || ['en'];
  },

  get ANONYMOUS_USERS_ENABLED() {
    return castBooleanEnv('ANONYMOUS_USERS_ENABLED', false);
  },
};
