import { vi } from 'vitest';
import fetchTableSchema from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery/fetchTableSchema';

const fetchMock = vi.fn();

const callOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'orders',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-secret',
};

function ok(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function queryResult(rows: unknown[]) {
  return {
    result_type: 'TuplesOk',
    result: [['row_to_json'], ...rows.map((row) => [JSON.stringify(row)])],
  };
}

function columnRow(
  columnName: string,
  ordinalPosition: number,
  overrides: Partial<{ is_unique: boolean; is_primary: boolean }> = {},
) {
  return {
    column_name: columnName,
    ordinal_position: ordinalPosition,
    data_type: 'uuid',
    udt_name: 'uuid',
    is_unique: false,
    is_primary: false,
    ...overrides,
  };
}

function foreignKeyConstraintRow(
  constraintName: string,
  columnName: string,
  constraintDefinition: string,
) {
  return {
    constraint_name: constraintName,
    constraint_type: 'f',
    column_name: columnName,
    constraint_definition: constraintDefinition,
  };
}

const COMPOSITE_FOREIGN_KEY =
  'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT';

function schemaResponse(): Response {
  return ok([
    queryResult([
      columnRow('tenant_id', 1),
      columnRow('account_id', 2),
      columnRow('owner_id', 3, { is_unique: true }),
    ]),
    queryResult([
      foreignKeyConstraintRow(
        'orders_account_fkey',
        'tenant_id',
        COMPOSITE_FOREIGN_KEY,
      ),
      foreignKeyConstraintRow(
        'orders_account_fkey',
        'account_id',
        COMPOSITE_FOREIGN_KEY,
      ),
      foreignKeyConstraintRow(
        'orders_owner_id_fkey',
        'owner_id',
        'FOREIGN KEY (owner_id) REFERENCES owners(id) ON UPDATE CASCADE ON DELETE SET NULL',
      ),
    ]),
  ]);
}

describe('fetchTableSchema', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('skips composite foreign keys and keeps single-column foreign keys', async () => {
    fetchMock.mockResolvedValueOnce(schemaResponse());

    const result = await fetchTableSchema(callOptions);

    expect(result.error).toBeNull();
    expect(result.foreignKeyRelations).toEqual([
      {
        name: 'orders_owner_id_fkey',
        columnName: 'owner_id',
        referencedSchema: 'public',
        referencedTable: 'owners',
        referencedColumn: 'id',
        updateAction: 'CASCADE',
        deleteAction: 'SET NULL',
        oneToOne: true,
      },
    ]);
    expect(
      result.columns.map(({ column_name, foreign_key_relation }) => [
        column_name,
        foreign_key_relation?.name ?? null,
      ]),
    ).toEqual([
      ['tenant_id', null],
      ['account_id', null],
      ['owner_id', 'orders_owner_id_fkey'],
    ]);
  });
});
