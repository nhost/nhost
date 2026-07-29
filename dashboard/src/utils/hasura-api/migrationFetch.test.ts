import { executeMigration } from '@/utils/hasura-api/migrationFetch';

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
  it('posts to the configured migrations API URL', async () => {
    await executeMigration(migrationRequest, {
      adminSecret: 'test-secret',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.migrate.example/apis/migrate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-hasura-admin-secret': 'test-secret',
        }),
      }),
    );
  });
});
