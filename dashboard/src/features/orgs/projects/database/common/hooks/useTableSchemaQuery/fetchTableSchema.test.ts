import fetchTableSchema from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery/fetchTableSchema';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

const fetchMock = vi.fn();
const callOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'orders',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-secret',
};

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function postgresError(statusCode: string) {
  return {
    error: 'database error',
    internal: {
      error: { message: 'database error', status_code: statusCode },
    },
  };
}

describe('fetchTableSchema', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('adapts missing introspection metadata to an empty schema result', async () => {
    fetchMock.mockResolvedValueOnce(
      response(postgresError(POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND), false),
    );

    await expect(fetchTableSchema(callOptions)).resolves.toEqual({
      columns: [],
      foreignKeyRelations: [],
      candidateKeys: [],
      uniqueConstraints: [],
      constraintColumnSets: [],
      error: null,
      metadata: {
        schema: 'public',
        table: 'orders',
        schemaNotFound: false,
        tableNotFound: true,
      },
    });
  });
});
