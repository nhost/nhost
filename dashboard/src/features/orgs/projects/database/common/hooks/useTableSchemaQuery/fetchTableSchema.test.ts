import { setupServer } from 'msw/node';
import fetchTableSchema from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery/fetchTableSchema';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';

const fetchMock = vi.fn();
const callOptions = {
  dataSource: 'default',
  schema: 'app',
  table: 'orders',
  appUrl: 'https://hasura.example',
  adminSecret: 'secret',
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
        schema: 'app',
        table: 'orders',
        schemaNotFound: false,
        tableNotFound: true,
      },
    });
  });
});

const fixtureServer = setupServer(tableQuery);

describe('tableQuery foreign-key fixture', () => {
  beforeAll(() => fixtureServer.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => fixtureServer.resetHandlers());
  afterAll(() => fixtureServer.close());

  it('serves a foreign key that survives catalog relation building', async () => {
    const result = await fetchTableSchema({
      dataSource: 'default',
      schema: 'public',
      table: 'town',
      appUrl: 'https://local.hasura.local.nhost.run',
      adminSecret: 'secret',
    });

    expect(result.foreignKeyRelations).toEqual([
      {
        name: 'town_countyId_fkey',
        columns: ['countyId'],
        referencedSchema: 'public',
        referencedTable: 'county',
        referencedColumns: ['id'],
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
        oneToOne: false,
      },
    ]);
    expect(result.columns[2]?.foreign_key_relation).toBe(
      result.foreignKeyRelations[0],
    );
  });
});
