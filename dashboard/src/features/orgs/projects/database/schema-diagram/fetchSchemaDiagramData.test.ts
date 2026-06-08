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
const fnHeader = ['data'];

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
    is_generated: 'ALWAYS' | 'NEVER';
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
    is_generated: 'NEVER',
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

function fnRow(
  overrides: Partial<{
    schema: string;
    name: string;
    oid: string;
    return_type: string;
    returns_set: boolean;
    provolatile: string;
    return_schema: string | null;
    return_table: string | null;
  }> = {},
): string {
  return JSON.stringify({
    schema: 'public',
    name: 'full_name',
    oid: '100',
    return_type: 'text',
    returns_set: false,
    provolatile: 's',
    return_schema: null,
    return_table: null,
    ...overrides,
  });
}

function bulkResponse(
  columnRows: string[],
  fkRows: string[],
  fnRows: string[] = [],
) {
  return ok([
    { result: [columnHeader, ...columnRows], result_type: 'TuplesOk' },
    { result: [fkHeader, ...fkRows], result_type: 'TuplesOk' },
    { result: [fnHeader, ...fnRows], result_type: 'TuplesOk' },
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
        isGenerated: false,
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
        isGenerated: false,
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

    expect(result).toEqual({
      columns: [],
      foreignKeys: [],
      functionReturnTypes: [],
    });
  });

  it('maps function rows into typed function return types', async () => {
    fetchMock.mockResolvedValueOnce(
      bulkResponse(
        [],
        [],
        [
          fnRow(),
          fnRow({
            schema: 'public',
            name: 'posts_for_user',
            oid: '200',
            return_type: 'public.posts',
            returns_set: true,
            provolatile: 'v',
            return_schema: 'public',
            return_table: 'posts',
          }),
        ],
      ),
    );

    const result = await fetchSchemaDiagramData(callArgs);

    expect(result.functionReturnTypes).toEqual([
      {
        schema: 'public',
        name: 'full_name',
        oid: '100',
        returnType: 'text',
        returnsSet: false,
        isVolatile: false,
        returnSchema: undefined,
        returnTable: undefined,
      },
      {
        schema: 'public',
        name: 'posts_for_user',
        oid: '200',
        returnType: 'public.posts',
        returnsSet: true,
        isVolatile: true,
        returnSchema: 'public',
        returnTable: 'posts',
      },
    ]);
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
    expect(body.args).toHaveLength(3);
    for (const arg of body.args) {
      expect(arg.type).toBe('run_sql');
      expect(arg.args.read_only).toBe(true);
      expect(arg.args.source).toBe('default');
    }
  });

  it("includes materialized-view columns via a UNION on pg_class where relkind='m'", async () => {
    fetchMock.mockResolvedValueOnce(bulkResponse([], []));

    await fetchSchemaDiagramData(callArgs);

    const [, init] = fetchMock.mock.calls[0];
    const columnSql: string = JSON.parse(init.body).args[0].args.sql;
    expect(columnSql).toMatch(/UNION ALL/i);
    expect(columnSql).toMatch(/relkind\s*=\s*'m'/);
    expect(columnSql).toMatch(/pg_attribute/);
  });

  it('resolves the return relation of set-returning functions via pg_type.typrelid → pg_class', async () => {
    fetchMock.mockResolvedValueOnce(bulkResponse([], []));

    await fetchSchemaDiagramData(callArgs);

    const [, init] = fetchMock.mock.calls[0];
    const functionSql: string = JSON.parse(init.body).args[2].args.sql;
    expect(functionSql).toMatch(/proretset/);
    expect(functionSql).toMatch(/provolatile/);
    expect(functionSql).toMatch(/typrelid/);
    expect(functionSql).toMatch(/relkind\s+IN/i);
    expect(functionSql).toMatch(/return_table/);
    expect(functionSql).toMatch(/p\.oid/);
  });
});
