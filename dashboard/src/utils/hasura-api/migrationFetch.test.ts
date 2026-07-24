/// <reference types="node" />
/// <reference types="vitest/globals" />

import { executeMigration } from '@/utils/hasura-api/generated/default/default';

const originalEnv = { ...process.env };
const fetchMock = vi.fn();
const migrationRequest = {
  name: 'test_migration',
  up: [],
  down: [],
  datasource: 'default',
  skip_execution: false,
};

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_PLATFORM: 'false',
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL:
      'https://custom.migrate.example/apis/migrate',
  };
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    status: 200,
    text: vi.fn().mockResolvedValue('{}'),
    headers: new Headers(),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('migrationFetch', () => {
  it('uses the migrations API URL in local mode', async () => {
    await executeMigration(migrationRequest, {
      baseUrl: 'https://local.graphql.local.nhost.run',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.migrate.example/apis/migrate',
      expect.anything(),
    );
  });

  it('uses the project-specific migration URL in platform mode', async () => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';

    await executeMigration(migrationRequest, {
      baseUrl: 'https://project.hasura.eu-west-1.nhost.run',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.hasura.eu-west-1.nhost.run/apis/migrate',
      expect.anything(),
    );
  });
});
