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

function queryResult(rows: string[]) {
  return {
    result_type: 'TuplesOk',
    result: [['row_to_json'], ...rows.map((row) => [row])],
  };
}

function postgresError(statusCode: string) {
  return {
    error: 'database error',
    internal: {
      error: { message: 'database error', status_code: statusCode },
    },
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

interface ConstraintRowOptions {
  name: string;
  type: 'f' | 'u';
  column: string;
  ordinality: number;
  referencedSchema?: string;
  referencedTable?: string;
  referencedColumn?: string;
}

function constraintRow({
  name,
  type,
  column,
  ordinality,
  referencedSchema,
  referencedTable,
  referencedColumn,
}: ConstraintRowOptions): string {
  return JSON.stringify({
    constraint_name: name,
    constraint_type: type,
    column_name: column,
    column_ordinality: ordinality,
    referenced_schema: referencedSchema,
    referenced_table: referencedTable,
    referenced_column_name: referencedColumn,
    update_action_code: type === 'f' ? 'a' : undefined,
    delete_action_code: type === 'f' ? 'a' : undefined,
  });
}

function schemaPayload(): unknown[] {
  return [
    queryResult([
      columnRow('tenant_id', 1),
      columnRow('account_id', 2),
      columnRow('last, first', 3),
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
      }),
      constraintRow({
        name: 'orders_account_fkey',
        type: 'f',
        column: 'account_id',
        ordinality: 2,
        referencedSchema: 'app',
        referencedTable: 'accounts',
        referencedColumn: 'id',
      }),
      constraintRow({
        name: 'orders_contact_fkey',
        type: 'f',
        column: 'last, first',
        ordinality: 1,
        referencedSchema: 'crm',
        referencedTable: 'contacts',
        referencedColumn: 'external, id',
      }),
      constraintRow({
        name: 'orders_account_key',
        type: 'u',
        column: 'tenant_id',
        ordinality: 1,
      }),
      constraintRow({
        name: 'orders_account_key',
        type: 'u',
        column: 'account_id',
        ordinality: 2,
      }),
    ]),
  ];
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
