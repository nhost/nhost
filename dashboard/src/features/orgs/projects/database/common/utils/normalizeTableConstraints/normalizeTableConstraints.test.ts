import { normalizeTableConstraints } from '@/features/orgs/projects/database/common/utils/normalizeTableConstraints';

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

describe('normalizeTableConstraints', () => {
  it('skips composite foreign keys and keeps single-column foreign keys', () => {
    const rawColumns = [
      columnRow('tenant_id', 1),
      columnRow('account_id', 2),
      columnRow('owner_id', 3, { is_unique: true }),
    ].map((column) => JSON.stringify(column));
    const rawConstraints = [
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
    ].map((constraint) => JSON.stringify(constraint));

    const result = normalizeTableConstraints(
      rawColumns,
      rawConstraints,
      'public',
    );

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
