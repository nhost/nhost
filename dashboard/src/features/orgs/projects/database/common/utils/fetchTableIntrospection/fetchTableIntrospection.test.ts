import { fetchTableIntrospection } from '@/features/orgs/projects/database/common/utils/fetchTableIntrospection';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

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

function queryResult(rows: string[]) {
  return {
    result_type: 'TuplesOk',
    result: [['row_to_json'], ...rows.map((row) => [row])],
  };
}

function postgresError(statusCode: string): Response {
  return response(
    {
      error: 'database error',
      internal: {
        error: { message: 'database error', status_code: statusCode },
      },
    },
    false,
  );
}

describe('fetchTableIntrospection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it.each([
    {
      statusCode: POSTGRESQL_ERROR_CODES.SCHEMA_NOT_FOUND,
      metadata: {
        schema: 'app',
        table: 'orders',
        schemaNotFound: true,
        tableNotFound: false,
      },
    },
    {
      statusCode: POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND,
      metadata: {
        schema: 'app',
        table: 'orders',
        schemaNotFound: false,
        tableNotFound: true,
      },
    },
    {
      statusCode: POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND,
      metadata: { schema: 'app', table: 'orders', columnsNotFound: true },
    },
  ])('returns missing metadata for $statusCode', async ({
    statusCode,
    metadata,
  }) => {
    fetchMock.mockResolvedValueOnce(postgresError(statusCode));

    await expect(fetchTableIntrospection(callOptions)).resolves.toEqual({
      kind: 'missing',
      metadata,
    });
  });

  it('uses pg_attribute introspection for materialized views', async () => {
    fetchMock.mockResolvedValueOnce(
      response([queryResult([]), queryResult([])]),
    );

    await expect(
      fetchTableIntrospection({
        ...callOptions,
        tableType: 'MATERIALIZED VIEW',
      }),
    ).resolves.toMatchObject({ kind: 'parsed' });
    const request = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );

    expect(request.args[0].args.sql).toContain('FROM PG_ATTRIBUTE ATTR');
  });

  it('throws non-missing PostgreSQL errors', async () => {
    fetchMock.mockResolvedValueOnce(postgresError('22000'));

    await expect(fetchTableIntrospection(callOptions)).rejects.toThrow(
      'database error',
    );
  });

  it('surfaces invalid introspection JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      response([queryResult([]), queryResult(['{invalid'])]),
    );

    await expect(fetchTableIntrospection(callOptions)).rejects.toThrow(
      'The database returned invalid JSON.',
    );
  });
});
