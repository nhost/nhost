import fetchTableSchema from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery/fetchTableSchema';
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

function columnRow(name: string, ordinality: number): string {
  return JSON.stringify({
    column_name: name,
    ordinal_position: ordinality,
    data_type: 'uuid',
    udt_name: 'uuid',
    is_unique: false,
    is_primary: false,
  });
}

function constraintRow(
  name: string,
  type: 'f' | 'u',
  column: string,
  ordinality: number,
  definition?: string,
): string {
  return JSON.stringify({
    constraint_name: name,
    constraint_type: type,
    constraint_definition: definition,
    column_name: column,
    column_ordinality: ordinality,
  });
}

function schemaPayload(): unknown[] {
  const definition =
    'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id)';

  return [
    queryResult([
      columnRow('tenant_id', 1),
      columnRow('account_id', 2),
      columnRow('last, first', 3),
    ]),
    queryResult([
      constraintRow('orders_account_fkey', 'f', 'tenant_id', 1, definition),
      constraintRow('orders_account_fkey', 'f', 'account_id', 2, definition),
      constraintRow(
        'orders_contact_fkey',
        'f',
        'last, first',
        1,
        'FOREIGN KEY ("last, first") REFERENCES crm.contacts("external, id")',
      ),
      constraintRow('orders_account_key', 'u', 'tenant_id', 1),
      constraintRow('orders_account_key', 'u', 'account_id', 2),
    ]),
  ];
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

describe('fetchTableSchema', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns one complete ordered composite relation and one-element singular arrays', async () => {
    fetchMock.mockResolvedValueOnce(response(schemaPayload()));

    const result = await fetchTableSchema(callOptions);

    expect(result.foreignKeyRelations).toEqual([
      {
        name: 'orders_account_fkey',
        columns: ['tenant_id', 'account_id'],
        referencedSchema: 'app',
        referencedTable: 'accounts',
        referencedColumns: ['tenant_id', 'id'],
        updateAction: 'NO ACTION',
        deleteAction: 'NO ACTION',
        oneToOne: true,
      },
      {
        name: 'orders_contact_fkey',
        columns: ['last, first'],
        referencedSchema: 'crm',
        referencedTable: 'contacts',
        referencedColumns: ['external, id'],
        updateAction: 'NO ACTION',
        deleteAction: 'NO ACTION',
        oneToOne: false,
      },
    ]);
    expect(result.candidateKeys[0]).toMatchObject({
      kind: 'uniqueConstraint',
      columns: ['tenant_id', 'account_id'],
    });
    const [compositeRelation] = result.foreignKeyRelations;
    expect(result.columns[0]?.foreign_key_relation).toBe(compositeRelation);
    expect(result.columns[1]?.foreign_key_relation).toBe(compositeRelation);
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
  ])('returns expanded empty metadata for $statusCode', async ({
    statusCode,
    metadata,
  }) => {
    fetchMock.mockResolvedValueOnce(postgresError(statusCode));

    await expect(fetchTableSchema(callOptions)).resolves.toEqual({
      columns: [],
      foreignKeyRelations: [],
      candidateKeys: [],
      uniqueConstraints: [],
      constraintColumnSets: [],
      error: null,
      metadata,
    });
  });

  it('throws non-missing PostgreSQL errors', async () => {
    fetchMock.mockResolvedValueOnce(postgresError('22000'));

    await expect(fetchTableSchema(callOptions)).rejects.toThrow(
      'database error',
    );
  });

  it.each([
    'VIEW',
    'MATERIALIZED VIEW',
  ] as const)('preserves empty %s schema loading', async (tableType) => {
    fetchMock.mockResolvedValueOnce(
      response([queryResult([]), queryResult([])]),
    );

    const result = await fetchTableSchema({ ...callOptions, tableType });
    const request = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );

    if (tableType === 'MATERIALIZED VIEW') {
      expect(request.args[0].args.sql).toContain('FROM PG_ATTRIBUTE ATTR');
    }
    expect(result).toMatchObject({
      columns: [],
      foreignKeyRelations: [],
      candidateKeys: [],
    });
  });

  it('uses the explicit invalid JSON error path', async () => {
    fetchMock.mockResolvedValueOnce(
      response([queryResult([columnRow('id', 1)]), queryResult(['{invalid'])]),
    );

    await expect(fetchTableSchema(callOptions)).rejects.toThrow(
      'The database returned invalid JSON.',
    );
  });
});
