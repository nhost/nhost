import { PROVIDERS } from '@config/index';
import logger from './logger';
import { ENV } from './utils/env';

function isUnset(val: any) {
  return (
    typeof val === 'undefined' || (typeof val === 'string' && val.length === 0)
  );
}

const errors: string[] = [];

[
  'HASURA_GRAPHQL_JWT_SECRET',
  'HASURA_GRAPHQL_GRAPHQL_URL',
  'HASURA_GRAPHQL_ADMIN_SECRET',
  'HASURA_GRAPHQL_DATABASE_URL',
].forEach((env) => {
  if (isUnset(process.env[env])) {
    errors.push(`No value was provided for required env var ${env}`);
  }
});

if (PROVIDERS.apple) {
  [
    'AUTH_APPLE_CLIENT_ID',
    'AUTH_APPLE_TEAM_ID',
    'AUTH_APPLE_KEY_ID',
    'AUTH_APPLE_PRIVATE_KEY',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Apple provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.windowslive) {
  ['AUTH_WINDOWS_LIVE_CLIENT_ID', 'AUTH_WINDOWS_LIVE_CLIENT_SECRET'].forEach(
    (env) => {
      if (isUnset(process.env[env])) {
        errors.push(
          `Env var ${env} is required when the Windows Live provider is enabled but no value was provided`
        );
      }
    }
  );
}

if (PROVIDERS.gitlab) {
  ['AUTH_GITLAB_CLIENT_ID', 'AUTH_GITLAB_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Gitlab provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.bitbucket) {
  ['AUTH_BITBUCKET_CLIENT_ID', 'AUTH_BITBUCKET_CLIENT_SECRET'].forEach(
    (env) => {
      if (isUnset(process.env[env])) {
        errors.push(
          `Env var ${env} is required when the Bitbucket provider is enabled but no value was provided`
        );
      }
    }
  );
}

if (PROVIDERS.spotify) {
  ['AUTH_SPOTIFY_CLIENT_ID', 'AUTH_SPOTIFY_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Spotify provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.linkedin) {
  ['AUTH_LINKEDIN_CLIENT_ID', 'AUTH_LINKEDIN_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the LinkedIn provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.twitter) {
  ['AUTH_TWITTER_CONSUMER_KEY', 'AUTH_TWITTER_CONSUMER_SECRET'].forEach(
    (env) => {
      if (isUnset(process.env[env])) {
        errors.push(
          `Env var ${env} is required when the Twitter provider is enabled but no value was provided`
        );
      }
    }
  );
}

if (PROVIDERS.facebook) {
  ['AUTH_FACEBOOK_CLIENT_ID', 'AUTH_FACEBOOK_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Facebook provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.google) {
  ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Google provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.github) {
  ['AUTH_GITHUB_CLIENT_ID', 'AUTH_GITHUB_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Github provider is enabled but no value was provided`
      );
    }
  });
}

if (
  ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED ||
  ENV.AUTH_PASSWORDLESS_EMAIL_ENABLED
) {
  ['AUTH_SMTP_HOST', 'AUTH_SMTP_USER', 'AUTH_SMTP_PASS'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when emails are enabled but no value was provided`
      );
    }
  });
}

if (errors.length) {
  logger.error(errors.join('\n'));
  throw new Error('Invalid configuration');
}
