import { vi } from 'vitest';
import fetchSchemaDiagramData from './fetchSchemaDiagramData';

const fetchMock = vi.fn();

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function notOk(body: unknown, status = 400) {
  return { ok: false, status, json: async () => body } as Response;
}

const callArgs = {
  appUrl: 'https://hasura.example',
  adminSecret: 'secret',
  dataSource: 'default',
};

const columnHeader = ['data'];
const fkHeader = ['data'];

function columnRow(
  overrides: Partial<{
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: 'YES' | 'NO';
    ordinal_position: number;
    is_primary: boolean;
  }> = {},
): string {
  return JSON.stringify({
    table_schema: 'public',
    table_name: 'users',
    column_name: 'id',
    data_type: 'uuid',
    udt_name: 'uuid',
    is_nullable: 'NO',
    ordinal_position: 1,
    is_primary: true,
    ...overrides,
  });
}

function fkRow(
  overrides: Partial<{
    from_schema: string;
    from_table: string;
    from_column: string;
    to_schema: string;
    to_table: string;
    to_column: string;
    constraint_name: string;
  }> = {},
): string {
  return JSON.stringify({
    from_schema: 'public',
    from_table: 'posts',
    from_column: 'author_id',
    to_schema: 'public',
    to_table: 'users',
    to_column: 'id',
    constraint_name: 'posts_author_id_fkey',
    ...overrides,
  });
}

function bulkResponse(columnRows: string[], fkRows: string[]) {
  return ok([
    { result: [columnHeader, ...columnRows], result_type: 'TuplesOk' },
    { result: [fkHeader, ...fkRows], result_type: 'TuplesOk' },
  ]);
}

describe('fetchSchemaDiagramData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('maps column rows (skipping the header row) into typed columns', async () => {
    fetchMock.mockResolvedValueOnce(
      bulkResponse(
        [
          columnRow(),
          columnRow({
            column_name: 'email',
            data_type: 'text',
            udt_name: 'text',
            is_nullable: 'YES',
            ordinal_position: 2,
            is_primary: false,
          }),
        ],
        [],
      ),
    );

    const result = await fetchSchemaDiagramData(callArgs);

    expect(result.columns).toEqual([
      {
        schema: 'public',
        table: 'users',
        columnName: 'id',
        dataType: 'uuid',
        udtName: 'uuid',
        isNullable: false,
        ordinalPosition: 1,
        isPrimary: true,
      },
      {
        schema: 'public',
        table: 'users',
        columnName: 'email',
        dataType: 'text',
        udtName: 'text',
        isNullable: true,
        ordinalPosition: 2,
        isPrimary: false,
      },
    ]);
  });

  it('maps foreign-key rows into typed foreign keys', async () => {
    fetchMock.mockResolvedValueOnce(
      bulkResponse(
        [],
        [
          fkRow(),
          fkRow({
            from_column: 'tenant_id',
            to_column: 'tenant_id',
            constraint_name: 'posts_author_id_fkey',
          }),
        ],
      ),
    );

    const result = await fetchSchemaDiagramData(callArgs);

    expect(result.foreignKeys).toEqual([
      {
        fromSchema: 'public',
        fromTable: 'posts',
        fromColumn: 'author_id',
        toSchema: 'public',
        toTable: 'users',
        toColumn: 'id',
        constraintName: 'posts_author_id_fkey',
      },
      {
        fromSchema: 'public',
        fromTable: 'posts',
        fromColumn: 'tenant_id',
        toSchema: 'public',
        toTable: 'users',
        toColumn: 'tenant_id',
        constraintName: 'posts_author_id_fkey',
      },
    ]);
  });

  it('returns empty arrays when only header rows are present', async () => {
    fetchMock.mockResolvedValueOnce(bulkResponse([], []));

    const result = await fetchSchemaDiagramData(callArgs);

    expect(result).toEqual({ columns: [], foreignKeys: [] });
  });

  it('coerces is_nullable "YES"/"NO" into a boolean', async () => {
    fetchMock.mockResolvedValueOnce(
      bulkResponse(
        [
          columnRow({ column_name: 'a', is_nullable: 'YES' }),
          columnRow({ column_name: 'b', is_nullable: 'NO' }),
        ],
        [],
      ),
    );

    const result = await fetchSchemaDiagramData(callArgs);

    expect(result.columns.map((c) => c.isNullable)).toEqual([true, false]);
  });

  it('throws using internal.error.message when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(
      notOk({
        code: 'postgres-error',
        error: 'Top-level error',
        path: '$',
        internal: {
          arguments: [],
          error: {
            message: 'permission denied for schema pg_catalog',
            exec_status: 'FatalError',
            status_code: '42501',
          },
          prepared: false,
          statement: '...',
        },
      }),
    );

    await expect(fetchSchemaDiagramData(callArgs)).rejects.toThrow(
      'permission denied for schema pg_catalog',
    );
  });

  it('throws using the top-level error when "error" is present without internal.error.message', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        code: 'unexpected',
        error: 'unexpected error',
        path: '$',
      }),
    );

    await expect(fetchSchemaDiagramData(callArgs)).rejects.toThrow(
      'unexpected error',
    );
  });

  it('throws a generic message when the response is not ok and contains no usable error fields', async () => {
    fetchMock.mockResolvedValueOnce(notOk({}));

    await expect(fetchSchemaDiagramData(callArgs)).rejects.toThrow(
      'Failed to fetch schema',
    );
  });

  it('sends the admin secret header and POSTs to /v2/query with a bulk envelope', async () => {
    fetchMock.mockResolvedValueOnce(bulkResponse([], []));

    await fetchSchemaDiagramData(callArgs);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hasura.example/v2/query');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-hasura-admin-secret': 'secret' });
    const body = JSON.parse(init.body);
    expect(body.type).toBe('bulk');
    expect(body.version).toBe(1);
    expect(body.args).toHaveLength(2);
    for (const arg of body.args) {
      expect(arg.type).toBe('run_sql');
      expect(arg.args.read_only).toBe(true);
      expect(arg.args.source).toBe('default');
    }
  });
});
