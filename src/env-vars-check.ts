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
  'SERVER_URL',
  'JWT_SECRET',
  'HASURA_ENDPOINT',
  'HASURA_GRAPHQL_ADMIN_SECRET',
  'DATABASE_URL',
  'APP_URL',
].forEach((env) => {
  if (isUnset(process.env[env])) {
    errors.push(`No value was provided for required env var ${env}`);
  }
});

if (PROVIDERS.apple) {
  [
    'APPLE_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Apple provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.windowslive) {
  ['WINDOWS_LIVE_CLIENT_ID', 'WINDOWS_LIVE_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Windows Live provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.gitlab) {
  ['GITLAB_CLIENT_ID', 'GITLAB_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Gitlab provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.bitbucket) {
  ['BITBUCKET_CLIENT_ID', 'BITBUCKET_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Bitbucket provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.spotify) {
  ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Spotify provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.linkedin) {
  ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the LinkedIn provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.twitter) {
  ['TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Twitter provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.facebook) {
  ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Facebook provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.google) {
  ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Google provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.github) {
  ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Github provider is enabled but no value was provided`
      );
    }
  });
}

if (ENV.EMAILS_ENABLED) {
  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].forEach((env) => {
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
