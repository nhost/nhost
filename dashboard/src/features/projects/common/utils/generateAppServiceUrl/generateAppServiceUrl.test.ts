import type { ProjectFragment } from '@/utils/__generated__/graphql';
import { test, vi } from 'vitest';
import generateAppServiceUrl, {
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

const region: ProjectFragment['region'] = {
  id: '1',
  name: 'eu-west-1',
  domain: 'nhost.run',
  city: 'Dublin',
  countryCode: 'IE',
};

const stagingRegion = { ...region, domain: 'staging.nhost.run' };

test('should generate a per service subdomain in remote mode', () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(generateAppServiceUrl('test', region, 'auth')).toBe(
    'https://test.auth.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', region, 'db')).toBe(
    'https://test.db.eu-west-1.nhost.run',
  );

  expect(generateAppServiceUrl('test', region, 'functions')).toBe(
    'https://test.functions.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', region, 'graphql')).toBe(
    'https://test.graphql.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', region, 'storage')).toBe(
    'https://test.storage.eu-west-1.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', region, 'hasura')).toBe(
    'https://test.hasura.eu-west-1.nhost.run',
  );

  expect(generateAppServiceUrl('test', region, 'grafana')).toBe(
    'https://test.grafana.eu-west-1.nhost.run/dashboards',
  );
});

test('should generate staging subdomains in staging environment', () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'staging';

  expect(generateAppServiceUrl('test', stagingRegion, 'auth')).toBe(
    'https://test.auth.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', stagingRegion, 'db')).toBe(
    'https://test.db.eu-west-1.staging.nhost.run',
  );

  expect(generateAppServiceUrl('test', stagingRegion, 'functions')).toBe(
    'https://test.functions.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', stagingRegion, 'graphql')).toBe(
    'https://test.graphql.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', stagingRegion, 'storage')).toBe(
    'https://test.storage.eu-west-1.staging.nhost.run/v1',
  );

  expect(generateAppServiceUrl('test', stagingRegion, 'hasura')).toBe(
    'https://test.hasura.eu-west-1.staging.nhost.run',
  );

  expect(generateAppServiceUrl('test', stagingRegion, 'grafana')).toBe(
    'https://test.grafana.eu-west-1.staging.nhost.run/dashboards',
  );
});

test('should generate no slug for Hasura and Grafana neither in local mode nor in remote mode', () => {
  process.env.NEXT_PUBLIC_NHOST_HASURA_API_URL = 'http://localhost:8082';
  process.env.NEXT_PUBLIC_ENV = 'staging';

  expect(generateAppServiceUrl('test', region, 'hasura')).toBe(
    'http://localhost:8082',
  );

  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';

  expect(generateAppServiceUrl('test', stagingRegion, 'hasura')).toBe(
    'https://test.hasura.eu-west-1.staging.nhost.run',
  );
  expect(generateAppServiceUrl('test', stagingRegion, 'grafana')).toBe(
    'https://test.grafana.eu-west-1.staging.nhost.run/dashboards',
  );

  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(generateAppServiceUrl('test', region, 'hasura')).toBe(
    'https://test.hasura.eu-west-1.nhost.run',
  );
  expect(generateAppServiceUrl('test', region, 'grafana')).toBe(
    'https://test.grafana.eu-west-1.nhost.run/dashboards',
  );
});

test('should be able to override the default remote backend slugs', () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';

  expect(
    generateAppServiceUrl('test', region, 'hasura', {
      ...defaultRemoteBackendSlugs,
      hasura: '/lorem-ipsum',
    }),
  ).toBe('https://test.hasura.eu-west-1.nhost.run/lorem-ipsum');
});

test('should construct service URLs based on environment variables', () => {
  process.env.NEXT_PUBLIC_NHOST_HASURA_API_URL = 'https://localdev0.nhost.run';

  expect(generateAppServiceUrl('test', region, 'hasura')).toBe(
    `https://localdev0.nhost.run`,
  );

  process.env.NEXT_PUBLIC_NHOST_AUTH_URL =
    'https://localdev1.nhost.run/v1/auth';

  expect(generateAppServiceUrl('test', region, 'auth')).toBe(
    `https://localdev1.nhost.run/v1/auth`,
  );

  process.env.NEXT_PUBLIC_NHOST_DATABASE_URL =
    'https://localdev2.nhost.run/v1/db';

  expect(generateAppServiceUrl('test', region, 'db')).toBe(
    `https://localdev2.nhost.run/v1/db`,
  );

  process.env.NEXT_PUBLIC_NHOST_STORAGE_URL =
    'https://localdev2.nhost.run/v1/storage';

  expect(generateAppServiceUrl('test', region, 'storage')).toBe(
    'https://localdev2.nhost.run/v1/storage',
  );

  process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL =
    'https://localdev3.nhost.run/v1/graphql';

  expect(generateAppServiceUrl('test', region, 'graphql')).toBe(
    'https://localdev3.nhost.run/v1/graphql',
  );

  process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL =
    'https://localdev4.nhost.run/v1/functions';

  expect(generateAppServiceUrl('test', region, 'functions')).toBe(
    'https://localdev4.nhost.run/v1/functions',
  );
});
