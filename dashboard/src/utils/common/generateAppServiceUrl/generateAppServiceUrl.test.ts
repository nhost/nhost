import { test, vi } from 'vitest';
import generateAppServiceUrl, {
  defaultLocalBackendSlugs,
  defaultRemoteBackendSlugs,
} from './generateAppServiceUrl';

const env = { ...(process.env || ({} as NodeJS.ProcessEnv)) };

beforeEach(() => {
  vi.resetModules();
});

beforeEach(() => {
  process.env = {
    NEXT_PUBLIC_NHOST_PLATFORM: 'false',
    NEXT_PUBLIC_ENV: 'dev',
    ...env,
  };
});

afterEach(() => {
  process.env = { ...env };
});

test('should generate a per service subdomain in remote mode', () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'auth')).toBe(
    'https://test.auth.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'functions')).toBe(
    'https://test.functions.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'graphql')).toBe(
    'https://test.graphql.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'storage')).toBe(
    'https://test.storage.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'https://test.hasura.eu-west-1.nhost.run',
  );
});

test('should generate staging subdomains in staging environment', () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'staging';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'auth')).toBe(
    'https://test.auth.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'functions')).toBe(
    'https://test.functions.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'graphql')).toBe(
    'https://test.graphql.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'storage')).toBe(
    'https://test.storage.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'https://test.hasura.eu-west-1.staging.nhost.run',
  );
});

test('should generate no slug for Hasura neither in local mode nor in remote mode', () => {
  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'http://localhost:1337',
  );

  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'staging';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'https://test.hasura.eu-west-1.staging.nhost.run',
  );

  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'https://test.hasura.eu-west-1.nhost.run',
  );
});

test('should be able to override the default local backend slugs', () => {
  expect(
    generateAppServiceUrl('test', 'eu-west-1', 'storage', {
      ...defaultLocalBackendSlugs,
      storage: '/v1/storage',
    }),
  ).toBe('http://localhost:1337/v1/storage');
});

test('should be able to override the default remote backend slugs', () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(
    generateAppServiceUrl(
      'test',
      'eu-west-1',
      'hasura',
      defaultLocalBackendSlugs,
      { ...defaultRemoteBackendSlugs, hasura: '/lorem-ipsum' },
    ),
  ).toBe('https://test.hasura.eu-west-1.nhost.run/lorem-ipsum');
});

test('should generate a basic subdomain without region in local mode', () => {
  expect(generateAppServiceUrl('test', 'eu-west-1', 'auth')).toBe(
    `http://localhost:1337/v1/auth`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'storage')).toBe(
    'http://localhost:1337/v1/files',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'graphql')).toBe(
    'http://localhost:1337/v1/graphql',
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'functions')).toBe(
    'http://localhost:1337/v1/functions',
  );
});

test('should generate a basic subdomain with a custom port if provided', () => {
  const CUSTOM_BACKEND_PORT = '1338';
  process.env.NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT = CUSTOM_BACKEND_PORT;

  expect(generateAppServiceUrl('test', 'eu-west-1', 'auth')).toBe(
    `http://localhost:${CUSTOM_BACKEND_PORT}/v1/auth`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'storage')).toBe(
    `http://localhost:${CUSTOM_BACKEND_PORT}/v1/files`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'graphql')).toBe(
    `http://localhost:${CUSTOM_BACKEND_PORT}/v1/graphql`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'functions')).toBe(
    `http://localhost:${CUSTOM_BACKEND_PORT}/v1/functions`,
  );
});
