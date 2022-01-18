import { PROVIDERS } from '@config/index';
import { logger } from './logger';

function isUnset(val?: string) {
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
    'AUTH_PROVIDER_APPLE_CLIENT_ID',
    'AUTH_PROVIDER_APPLE_TEAM_ID',
    'AUTH_PROVIDER_APPLE_KEY_ID',
    'AUTH_PROVIDER_APPLE_PRIVATE_KEY',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Apple provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.windowslive) {
  [
    'AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_ID',
    'AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Windows Live provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.gitlab) {
  [
    'AUTH_PROVIDER_GITLAB_CLIENT_ID',
    'AUTH_PROVIDER_GITLAB_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Gitlab provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.bitbucket) {
  [
    'AUTH_PROVIDER_BITBUCKET_CLIENT_ID',
    'AUTH_PROVIDER_BITBUCKET_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Bitbucket provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.spotify) {
  [
    'AUTH_PROVIDER_SPOTIFY_CLIENT_ID',
    'AUTH_PROVIDER_SPOTIFY_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Spotify provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.linkedin) {
  [
    'AUTH_PROVIDER_LINKEDIN_CLIENT_ID',
    'AUTH_PROVIDER_LINKEDIN_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the LinkedIn provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.twitter) {
  [
    'AUTH_PROVIDER_TWITTER_CONSUMER_KEY',
    'AUTH_PROVIDER_TWITTER_CONSUMER_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Twitter provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.facebook) {
  [
    'AUTH_PROVIDER_FACEBOOK_CLIENT_ID',
    'AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Facebook provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.google) {
  [
    'AUTH_PROVIDER_GOOGLE_CLIENT_ID',
    'AUTH_PROVIDER_GOOGLE_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Google provider is enabled but no value was provided`
      );
    }
  });
}

if (PROVIDERS.github) {
  [
    'AUTH_PROVIDER_GITHUB_CLIENT_ID',
    'AUTH_PROVIDER_GITHUB_CLIENT_SECRET',
  ].forEach((env) => {
    if (isUnset(process.env[env])) {
      errors.push(
        `Env var ${env} is required when the Github provider is enabled but no value was provided`
      );
    }
  });
}

if (errors.length) {
  logger.error(errors.join('\n'));
  throw new Error('Invalid configuration');
}
