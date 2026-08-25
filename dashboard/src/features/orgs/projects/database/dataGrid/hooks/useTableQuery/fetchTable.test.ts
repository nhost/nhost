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

function postgresError(statusCode: string) {
  return {
    error: 'database error',
    internal: {
      error: { message: 'database error', status_code: statusCode },
    },
  };
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

interface ConstraintRowOptions {
  name: string;
  type: 'f' | 'p' | 'u' | 'i';
  column: string;
  ordinality: number;
  referencedSchema?: string;
  referencedTable?: string;
  referencedColumn?: string;
  updateActionCode?: string;
  deleteActionCode?: string;
}

function constraintRow({
  name,
  type,
  column,
  ordinality,
  referencedSchema,
  referencedTable,
  referencedColumn,
  updateActionCode,
  deleteActionCode,
}: ConstraintRowOptions): string {
  return JSON.stringify({
    constraint_name: name,
    constraint_type: type,
    column_name: column,
    column_ordinality: ordinality,
    referenced_schema: referencedSchema,
    referenced_table: referencedTable,
    referenced_column_name: referencedColumn,
    update_action_code: updateActionCode,
    delete_action_code: deleteActionCode,
  });
}

function mixedSchemaPayload(): unknown[] {
  return [
    queryResult([
      columnRow('id', 1, { is_primary: true }),
      columnRow('tenant_id', 2),
      columnRow('account_id', 3),
      columnRow('owner_id', 4, { is_unique: true }),
      columnRow('last, first', 5),
      columnRow('malformed_id', 6),
    ]),
    queryResult([
      constraintRow({
        name: 'orders_account_fkey',
        type: 'f',
        column: 'tenant_id',
        ordinality: 1,
        referencedSchema: 'app',
        referencedTable: 'accounts',
        referencedColumn: 'tenant_id',
        updateActionCode: 'c',
        deleteActionCode: 'r',
      }),
      constraintRow({
        name: 'orders_account_fkey',
        type: 'f',
        column: 'account_id',
        ordinality: 2,
        referencedSchema: 'app',
        referencedTable: 'accounts',
        referencedColumn: 'id',
        updateActionCode: 'c',
        deleteActionCode: 'r',
      }),
      constraintRow({
        name: 'orders_owner_id_fkey',
        type: 'f',
        column: 'owner_id',
        ordinality: 1,
        referencedSchema: 'app',
        referencedTable: 'owners',
        referencedColumn: 'id',
        updateActionCode: 'c',
        deleteActionCode: 'n',
      }),
      constraintRow({
        name: 'orders_contact_fkey',
        type: 'f',
        column: 'last, first',
        ordinality: 1,
        referencedSchema: 'crm',
        referencedTable: 'contacts',
        referencedColumn: 'external, id',
        updateActionCode: 'd',
        deleteActionCode: 'a',
      }),
      constraintRow({
        name: 'orders_malformed_fkey',
        type: 'f',
        column: 'malformed_id',
        ordinality: 1,
        referencedSchema: 'app',
        referencedTable: '',
        referencedColumn: 'id',
        updateActionCode: 'a',
        deleteActionCode: 'a',
      }),
      constraintRow({
        name: 'orders_ghost_fkey',
        type: 'f',
        column: 'ghost_id',
        ordinality: 1,
        referencedSchema: 'app',
        referencedTable: 'parents',
        referencedColumn: 'id',
        updateActionCode: 'a',
        deleteActionCode: 'a',
      }),
      constraintRow({
        name: 'orders_pkey',
        type: 'p',
        column: 'id',
        ordinality: 1,
      }),
      constraintRow({
        name: 'orders_owner_key',
        type: 'u',
        column: 'owner_id',
        ordinality: 1,
      }),
    ]),
  ];
}

function rowsPayload(): unknown[] {
  return [
    queryResult([
      JSON.stringify({ id: 'order-1', owner_id: 'owner-1' }),
      JSON.stringify({ id: 'order-2', owner_id: 'owner-2' }),
    ]),
    queryResult(['2'], 'count'),
  ];
}

describe('fetchTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns complete ordered composite and singular relations with rows and count', async () => {
    fetchMock
      .mockResolvedValueOnce(ok(mixedSchemaPayload()))
      .mockResolvedValueOnce(ok(rowsPayload()));

    const result = await fetchTable(callOptions);

    expect(result.rows).toHaveLength(2);
    expect(result.numberOfRows).toBe(2);
    expect(result.foreignKeyRelations).toEqual([
      {
        name: 'orders_account_fkey',
        columns: ['tenant_id', 'account_id'],
        referencedSchema: 'app',
        referencedTable: 'accounts',
        referencedColumns: ['tenant_id', 'id'],
        updateAction: 'CASCADE',
        deleteAction: 'RESTRICT',
        oneToOne: false,
      },
      {
        name: 'orders_contact_fkey',
        columns: ['last, first'],
        referencedSchema: 'crm',
        referencedTable: 'contacts',
        referencedColumns: ['external, id'],
        updateAction: 'SET DEFAULT',
        deleteAction: 'NO ACTION',
        oneToOne: false,
      },
      {
        name: 'orders_owner_id_fkey',
        columns: ['owner_id'],
        referencedSchema: 'app',
        referencedTable: 'owners',
        referencedColumns: ['id'],
        updateAction: 'CASCADE',
        deleteAction: 'SET NULL',
        oneToOne: true,
      },
    ]);
    expect(result.candidateKeys.map(({ name }) => name)).toEqual([
      'orders_pkey',
      'orders_owner_key',
    ]);
    expect(result.uniqueConstraints).toHaveLength(1);

    const compositeRelation = result.foreignKeyRelations[0];
    expect(
      result.columns.find(({ column_name: name }) => name === 'tenant_id')
        ?.foreign_key_relation,
    ).toBe(compositeRelation);
    expect(
      result.columns.find(({ column_name: name }) => name === 'account_id')
        ?.foreign_key_relation,
    ).toBe(compositeRelation);
    expect(
      result.columns.find(({ column_name: name }) => name === 'malformed_id')
        ?.foreign_key_relation,
    ).toBeNull();
  });

  it('adapts missing introspection metadata to an empty table result', async () => {
    fetchMock.mockResolvedValueOnce(
      notOk(postgresError(POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND)),
    );

    await expect(fetchTable(callOptions)).resolves.toEqual({
      columns: [],
      rows: [],
      error: null,
      foreignKeyRelations: [],
      candidateKeys: [],
      uniqueConstraints: [],
      constraintColumnSets: [],
      numberOfRows: 0,
      metadata: {
        schema: 'app',
        table: 'orders',
        schemaNotFound: false,
        tableNotFound: true,
      },
    });
  });

  it('retains complete introspection metadata when fetching rows fails', async () => {
    fetchMock
      .mockResolvedValueOnce(ok(mixedSchemaPayload()))
      .mockResolvedValueOnce(notOk({ error: 'row query failed' }));

    const result = await fetchTable(callOptions);

    expect(result.error).toBe(
      'Something went wrong while fetching the table rows.',
    );
    expect(result.foreignKeyRelations).toHaveLength(3);
    expect(result.candidateKeys).toHaveLength(2);
    expect(result.rows).toEqual([]);
  });

  it.each([
    'VIEW',
    'MATERIALIZED VIEW',
  ] as const)('preserves %s row and count loading', async (tableType) => {
    fetchMock
      .mockResolvedValueOnce(ok([queryResult([]), queryResult([])]))
      .mockResolvedValueOnce(ok(rowsPayload()));

    const result = await fetchTable({ ...callOptions, tableType });

    expect(result.rows).toHaveLength(2);
    expect(result.numberOfRows).toBe(2);
  });

  it('uses the explicit invalid JSON error path for rows', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([queryResult([]), queryResult([])]))
      .mockResolvedValueOnce(
        ok([queryResult(['{invalid']), queryResult(['1'], 'count')]),
      );

    await expect(fetchTable(callOptions)).rejects.toThrow(
      'The database returned invalid JSON.',
    );
  });
});
