import { vi } from 'vitest';
import fetchTable from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/fetchTable';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

const fetchMock = vi.fn();

const callOptions = {
  dataSource: 'default',
  schema: 'app',
  table: 'orders',
  appUrl: 'https://hasura.example',
  adminSecret: 'secret',
};

function ok(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function notOk(body: unknown): Response {
  return { ok: false, json: async () => body } as Response;
}

function queryResult(rows: string[], header = 'row_to_json') {
  return {
    result_type: 'TuplesOk',
    result: [[header], ...rows.map((row) => [row])],
  };
}

function columnRow(
  columnName: string,
  ordinalPosition: number,
  overrides: Partial<{ is_unique: boolean; is_primary: boolean }> = {},
): string {
  return JSON.stringify({
    column_name: columnName,
    ordinal_position: ordinalPosition,
    data_type: 'uuid',
    udt_name: 'uuid',
    is_unique: false,
    is_primary: false,
    ...overrides,
  });
}

function constraintRow(
  constraintName: string,
  columnName: string,
  constraintDefinition: string,
): string {
  return JSON.stringify({
    constraint_name: constraintName,
    constraint_type: 'f',
    constraint_definition: constraintDefinition,
    column_name: columnName,
  });
}

function mixedSchemaResponse(): Response {
  return ok([
    queryResult([
      columnRow('id', 1, { is_primary: true }),
      columnRow('tenant_id', 2),
      columnRow('account_id', 3),
      columnRow('owner_id', 4, { is_unique: true }),
      columnRow('last, first', 5),
      columnRow('malformed_id', 6),
      columnRow('empty_table_id', 7),
      columnRow('empty_column_id', 8),
    ]),
    queryResult([
      constraintRow(
        'orders_account_fkey',
        'tenant_id',
        'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
      ),
      constraintRow(
        'orders_account_fkey',
        'account_id',
        'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
      ),
      constraintRow(
        'orders_owner_id_fkey',
        'owner_id',
        'FOREIGN KEY (owner_id) REFERENCES owners(id) ON UPDATE CASCADE ON DELETE SET NULL',
      ),
      constraintRow(
        'orders_contact_fkey',
        'last, first',
        'FOREIGN KEY ("last, first") REFERENCES crm.contacts("external, id") ON UPDATE SET DEFAULT ON DELETE NO ACTION',
      ),
      constraintRow(
        'orders_malformed_fkey',
        'malformed_id',
        'not a foreign key constraint',
      ),
      constraintRow(
        '',
        'malformed_id',
        'FOREIGN KEY (malformed_id) REFERENCES parents(id)',
      ),
      constraintRow(
        'orders_empty_table_fkey',
        'empty_table_id',
        'FOREIGN KEY (empty_table_id) REFERENCES (id)',
      ),
      constraintRow(
        'orders_empty_column_fkey',
        'empty_column_id',
        'FOREIGN KEY (empty_column_id) REFERENCES parents()',
      ),
      constraintRow(
        'orders_ghost_fkey',
        'ghost_id',
        'FOREIGN KEY (ghost_id) REFERENCES parents(id)',
      ),
    ]),
  ]);
}

function rowsResponse(): Response {
  return ok([
    queryResult([
      JSON.stringify({ id: 'order-1', owner_id: 'owner-1' }),
      JSON.stringify({ id: 'order-2', owner_id: 'owner-2' }),
    ]),
    queryResult(['2'], 'count'),
  ]);
}

function postgresError(statusCode: string): Response {
  return notOk({
    error: 'database error',
    internal: {
      error: {
        message: 'database error',
        status_code: statusCode,
      },
    },
  });
}

describe('fetchTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('omits composite and malformed relations while preserving singular relations, rows, and count', async () => {
    fetchMock
      .mockResolvedValueOnce(mixedSchemaResponse())
      .mockResolvedValueOnce(rowsResponse());

    const result = await fetchTable(callOptions);

    expect(result.rows).toEqual([
      { id: 'order-1', owner_id: 'owner-1' },
      { id: 'order-2', owner_id: 'owner-2' },
    ]);
    expect(result.numberOfRows).toBe(2);
    expect(result.error).toBeNull();
    expect(result.foreignKeyRelations).toEqual([
      {
        name: 'orders_owner_id_fkey',
        columnName: 'owner_id',
        referencedSchema: 'app',
        referencedTable: 'owners',
        referencedColumn: 'id',
        updateAction: 'CASCADE',
        deleteAction: 'SET NULL',
        oneToOne: true,
      },
      {
        name: 'orders_contact_fkey',
        columnName: 'last, first',
        referencedSchema: 'crm',
        referencedTable: 'contacts',
        referencedColumn: 'external, id',
        updateAction: 'SET DEFAULT',
        deleteAction: 'NO ACTION',
        oneToOne: false,
      },
    ]);

    expect(
      result.columns.find(({ column_name }) => column_name === 'owner_id')
        ?.foreign_key_relation,
    ).toMatchObject({
      name: 'orders_owner_id_fkey',
      referencedSchema: 'app',
      updateAction: 'CASCADE',
      deleteAction: 'SET NULL',
    });
    expect(
      result.columns.find(({ column_name }) => column_name === 'last, first')
        ?.foreign_key_relation,
    ).toMatchObject({
      name: 'orders_contact_fkey',
      referencedColumn: 'external, id',
    });

    for (const columnName of [
      'tenant_id',
      'account_id',
      'malformed_id',
      'empty_table_id',
      'empty_column_id',
    ]) {
      expect(
        result.columns.find(({ column_name }) => column_name === columnName)
          ?.foreign_key_relation,
      ).toBeNull();
    }
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
      metadata: {
        schema: 'app',
        table: 'orders',
        columnsNotFound: true,
      },
    },
  ])('preserves the $statusCode missing-object response', async ({
    statusCode,
    metadata,
  }) => {
    fetchMock.mockResolvedValueOnce(postgresError(statusCode));

    await expect(fetchTable(callOptions)).resolves.toEqual({
      columns: [],
      rows: [],
      error: null,
      numberOfRows: 0,
      foreignKeyRelations: [],
      metadata,
    });
  });

  it('uses the materialized-view column query and still returns rows and count', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([queryResult([]), queryResult([])]))
      .mockResolvedValueOnce(rowsResponse());

    const result = await fetchTable({
      ...callOptions,
      tableType: 'MATERIALIZED VIEW',
    });

    const firstRequest = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = JSON.parse(firstRequest.body as string);

    expect(requestBody.args[0].args.sql).toContain('FROM PG_ATTRIBUTE ATTR');
    expect(result.rows).toHaveLength(2);
    expect(result.numberOfRows).toBe(2);
  });
});
