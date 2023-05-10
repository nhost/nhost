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
    NEXT_PUBLIC_NHOST_AUTH_URL: 'https://localdev.nhost.run/v1/auth',
    NEXT_PUBLIC_NHOST_FUNCTIONS_URL: 'https://localdev.nhost.run/v1/functions',
    NEXT_PUBLIC_NHOST_GRAPHQL_URL: 'https://localdev.nhost.run/v1/graphql',
    NEXT_PUBLIC_NHOST_STORAGE_URL: 'https://localdev.nhost.run/v1/storage',
    NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL: 'http://localhost:9695',
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: 'http://localhost:9693',
    NEXT_PUBLIC_NHOST_HASURA_API_URL: 'http://localhost:8080',
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

  expect(generateAppServiceUrl('test', 'eu-west-1', 'grafana')).toBe(
    'https://test.grafana.eu-west-1.nhost.run',
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

  expect(generateAppServiceUrl('test', 'eu-west-1', 'grafana')).toBe(
    'https://test.grafana.eu-west-1.staging.nhost.run',
  );
});

test('should generate no slug for Hasura and Grafana neither in local mode nor in remote mode', () => {
  process.env.NEXT_PUBLIC_NHOST_HASURA_API_URL = 'http://localhost:8082';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'http://localhost:8082',
  );

  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'staging';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'https://test.hasura.eu-west-1.staging.nhost.run',
  );
  expect(generateAppServiceUrl('test', 'eu-west-1', 'grafana')).toBe(
    'https://test.grafana.eu-west-1.staging.nhost.run',
  );

  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    'https://test.hasura.eu-west-1.nhost.run',
  );
  expect(generateAppServiceUrl('test', 'eu-west-1', 'grafana')).toBe(
    'https://test.grafana.eu-west-1.nhost.run',
  );
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

test('should construct service URLs based on environment variables', () => {
  process.env.NEXT_PUBLIC_NHOST_HASURA_API_URL = 'https://localdev0.nhost.run';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'hasura')).toBe(
    `https://localdev0.nhost.run`,
  );

  process.env.NEXT_PUBLIC_NHOST_AUTH_URL =
    'https://localdev1.nhost.run/v1/auth';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'auth')).toBe(
    `https://localdev1.nhost.run/v1/auth`,
  );

  process.env.NEXT_PUBLIC_NHOST_STORAGE_URL =
    'https://localdev2.nhost.run/v1/storage';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'storage')).toBe(
    'https://localdev2.nhost.run/v1/storage',
  );

  process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL =
    'https://localdev3.nhost.run/v1/graphql';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'graphql')).toBe(
    'https://localdev3.nhost.run/v1/graphql',
  );

  process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL =
    'https://localdev4.nhost.run/v1/functions';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'functions')).toBe(
    'https://localdev4.nhost.run/v1/functions',
  );
});

test('should generate a basic subdomain with a custom port if provided', () => {
  process.env.NEXT_PUBLIC_NHOST_BACKEND_URL = `http://localhost:1338`;
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';

  expect(generateAppServiceUrl('test', 'eu-west-1', 'auth')).toBe(
    `http://localhost:1338/v1/auth`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'storage')).toBe(
    `http://localhost:1338/v1/files`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'graphql')).toBe(
    `http://localhost:1338/v1/graphql`,
  );

  expect(generateAppServiceUrl('test', 'eu-west-1', 'functions')).toBe(
    `http://localhost:1338/v1/functions`,
  );
});
