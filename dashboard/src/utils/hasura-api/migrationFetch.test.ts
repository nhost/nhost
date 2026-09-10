import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';

const originalEnv = { ...process.env };
const fetchMock = vi.fn();
const MIGRATION_URL =
  'http://local.migrations.local.nhost.run:9693/apis/migrate';
const HASURA_APP_URL = 'http://local.hasura.local.nhost.run:8080';
const ADMIN_SECRET = 'super-secret-token';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const migrationRequest = {
  name: 'test_migration',
  up: [],
  down: [],
  datasource: 'default',
  skip_execution: false,
};

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: MIGRATION_URL,
  };
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({}, 200));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe('executeMigration', () => {
  it('posts to the configured migrations API URL without forwarding the Hasura target', async () => {
    await executeMigration(migrationRequest, {
      appUrl: HASURA_APP_URL,
      adminSecret: ADMIN_SECRET,
    });

    const [url, requestInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & Record<string, unknown>,
    ];
    expect(url).toBe(MIGRATION_URL);
    expect(requestInit).not.toHaveProperty('appUrl');
    expect(requestInit.headers).not.toHaveProperty('appUrl');
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-hasura-admin-secret': ADMIN_SECRET,
        }),
      }),
    );
  });

  it('throws a safe typed error for the canonical migrations API conflict', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: 'data_api_error',
          message: JSON.stringify({
            path: '$',
            error: CONFLICT_MESSAGE,
            code: 'conflict',
            internal: { credential: ADMIN_SECRET },
          }),
          request_body: { credential: ADMIN_SECRET },
        },
        400,
      ),
    );

    let thrown: unknown;
    try {
      await executeMigration(migrationRequest, {
        appUrl: HASURA_APP_URL,
        adminSecret: ADMIN_SECRET,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MetadataVersionConflictError);
    expect(thrown).toMatchObject({
      message: CONFLICT_MESSAGE,
      origin: { appUrl: HASURA_APP_URL },
    });
    expect(JSON.stringify(thrown)).not.toContain(ADMIN_SECRET);
    expect((thrown as Error).stack).not.toContain(ADMIN_SECRET);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns unrelated 400 responses unchanged', async () => {
    const data = {
      code: 'data_api_error',
      message: JSON.stringify({
        path: '$',
        error: 'relation already exists',
        code: 'postgres-error',
      }),
    };
    fetchMock.mockResolvedValue(jsonResponse(data, 400));

    await expect(
      executeMigration(migrationRequest, {
        appUrl: HASURA_APP_URL,
        adminSecret: ADMIN_SECRET,
      }),
    ).resolves.toMatchObject({ status: 400, data });
  });

  it('preserves network errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(networkError);

    await expect(
      executeMigration(migrationRequest, {
        appUrl: HASURA_APP_URL,
        adminSecret: ADMIN_SECRET,
      }),
    ).rejects.toBe(networkError);
  });
});
