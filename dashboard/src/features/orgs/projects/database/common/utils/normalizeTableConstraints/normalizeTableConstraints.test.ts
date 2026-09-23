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

function constraintRow(
  constraintName: string,
  constraintType: string,
  columnName: string,
  constraintDefinition: string,
) {
  return {
    constraint_name: constraintName,
    constraint_type: constraintType,
    column_name: columnName,
    constraint_definition: constraintDefinition,
  };
}

const COMPOSITE_FOREIGN_KEY =
  'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT';

describe('normalizeTableConstraints', () => {
  it('keeps composite and single-column foreign keys', () => {
    const rawColumns = [
      columnRow('tenant_id', 1),
      columnRow('account_id', 2),
      columnRow('owner_id', 3, { is_unique: true }),
    ].map((column) => JSON.stringify(column));
    const rawConstraints = [
      constraintRow(
        'orders_account_fkey',
        'f',
        'tenant_id',
        COMPOSITE_FOREIGN_KEY,
      ),
      constraintRow(
        'orders_account_fkey',
        'f',
        'account_id',
        COMPOSITE_FOREIGN_KEY,
      ),
      constraintRow(
        'orders_owner_id_fkey',
        'f',
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
        name: 'orders_account_fkey',
        columns: ['tenant_id', 'account_id'],
        referencedSchema: 'public',
        referencedTable: 'accounts',
        referencedColumns: ['tenant_id', 'id'],
        updateAction: 'CASCADE',
        deleteAction: 'RESTRICT',
        oneToOne: false,
      },
      {
        name: 'orders_owner_id_fkey',
        columns: ['owner_id'],
        referencedSchema: 'public',
        referencedTable: 'owners',
        referencedColumns: ['id'],
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
      ['tenant_id', 'orders_account_fkey'],
      ['account_id', 'orders_account_fkey'],
      ['owner_id', 'orders_owner_id_fkey'],
    ]);
  });

  it('returns candidate keys with the column order from the constraint definition', () => {
    const rawColumns = [
      columnRow('tenant_id', 1, { is_primary: true }),
      columnRow('account_id', 2, { is_primary: true }),
      columnRow('email', 3, { is_unique: true }),
    ].map((column) => JSON.stringify(column));
    const rawConstraints = [
      constraintRow(
        'orders_pkey',
        'p',
        'account_id',
        'PRIMARY KEY (tenant_id, account_id)',
      ),
      constraintRow(
        'orders_pkey',
        'p',
        'tenant_id',
        'PRIMARY KEY (tenant_id, account_id)',
      ),
      constraintRow('orders_email_key', 'u', 'email', 'UNIQUE (email)'),
    ].map((constraint) => JSON.stringify(constraint));

    const result = normalizeTableConstraints(
      rawColumns,
      rawConstraints,
      'public',
    );

    expect(result.candidateKeys).toEqual([
      {
        name: 'orders_pkey',
        isPrimary: true,
        columns: ['tenant_id', 'account_id'],
      },
      { name: 'orders_email_key', isPrimary: false, columns: ['email'] },
    ]);
  });
});
