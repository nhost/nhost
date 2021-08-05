import { castBooleanEnv } from '@config/utils';

/**
 * * Authentication settings
 */
export const AUTHENTICATION = {
  get ENABLED() {
    return (
      castBooleanEnv('AUTH_ENABLED') || castBooleanEnv('AUTH_ENABLE') || true
    );
  },
  get AUTH_LOCAL_USERS_ENABLED() {
    return (
      castBooleanEnv('AUTH_LOCAL_USERS_ENABLE') ||
      castBooleanEnv('AUTH_LOCAL_USERS_ENABLED') ||
      true
    );
  },
  get CHANGE_EMAIL_ENABLED() {
    return (
      castBooleanEnv('CHANGE_EMAIL_ENABLED') ||
      castBooleanEnv('CHANGE_EMAIL_ENABLE') ||
      true
    );
  },
  get NOTIFY_EMAIL_CHANGE() {
    return castBooleanEnv('NOTIFY_EMAIL_CHANGE', false);
  },
  get ANONYMOUS_USERS_ENABLED() {
    return (
      castBooleanEnv('ANONYMOUS_USERS_ENABLED') ||
      castBooleanEnv('ANONYMOUS_USERS_ENABLE')
    );
  },
  get ALLOW_USER_SELF_DELETE() {
    return castBooleanEnv('ALLOW_USER_SELF_DELETE', false);
  },
  get VERIFY_EMAILS() {
    return castBooleanEnv('VERIFY_EMAILS', false);
  },
  get LOST_PASSWORD_ENABLED() {
    return (
      castBooleanEnv('LOST_PASSWORD_ENABLED') ||
      castBooleanEnv('LOST_PASSWORD_ENABLE')
    );
  },
  get USER_IMPERSONATION_ENABLED() {
    return (
      castBooleanEnv('USER_IMPERSONATION_ENABLED') ||
      castBooleanEnv('USER_IMPERSONATION_ENABLE')
    );
  },
  get MAGIC_LINK_ENABLED() {
    return (
      castBooleanEnv('MAGIC_LINK_ENABLED') ||
      castBooleanEnv('MAGIC_LINK_ENABLE')
    );
  },
};
