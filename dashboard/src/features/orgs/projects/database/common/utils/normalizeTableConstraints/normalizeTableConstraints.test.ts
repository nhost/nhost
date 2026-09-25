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
      constraintRow(
        'orders_owner_id_idx',
        'i',
        'owner_id',
        'UNIQUE (owner_id)',
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

  it('keeps the referenced key name of each foreign key', () => {
    const rawColumns = [
      columnRow('account_id', 1),
      columnRow('owner_id', 2),
    ].map((column) => JSON.stringify(column));
    const rawConstraints = [
      {
        ...constraintRow(
          'orders_account_id_fkey',
          'f',
          'account_id',
          'FOREIGN KEY (account_id) REFERENCES accounts(id)',
        ),
        referenced_key_name: 'accounts_pkey',
      },
      {
        ...constraintRow(
          'orders_owner_id_fkey',
          'f',
          'owner_id',
          'FOREIGN KEY (owner_id) REFERENCES owners(id)',
        ),
        referenced_key_name: null,
      },
    ].map((constraint) => JSON.stringify(constraint));

    const result = normalizeTableConstraints(
      rawColumns,
      rawConstraints,
      'public',
    );

    expect(
      result.foreignKeyRelations.map(({ name, referencedKeyName }) => [
        name,
        referencedKeyName,
      ]),
    ).toEqual([
      ['orders_account_id_fkey', 'accounts_pkey'],
      ['orders_owner_id_fkey', undefined],
    ]);
  });

  it('keeps a standalone unique index as the referenced key name', () => {
    const rawColumns = [
      columnRow('external_id', 1, { is_unique: true }),
      columnRow('parent_external_id', 2),
    ].map((column) => JSON.stringify(column));
    const rawConstraints = [
      {
        ...constraintRow(
          'orders_parent_external_id_fkey',
          'f',
          'parent_external_id',
          'FOREIGN KEY (parent_external_id) REFERENCES orders(external_id)',
        ),
        referenced_key_name: 'orders_external_id_idx',
      },
      {
        ...constraintRow(
          'orders_external_id_idx',
          'i',
          'external_id',
          'UNIQUE (external_id)',
        ),
        referenced_key_name: null,
      },
    ].map((constraint) => JSON.stringify(constraint));

    const result = normalizeTableConstraints(
      rawColumns,
      rawConstraints,
      'public',
    );

    expect(result.foreignKeyRelations[0].referencedKeyName).toBe(
      'orders_external_id_idx',
    );
    expect(result.candidateKeys).toEqual([
      {
        name: 'orders_external_id_idx',
        isPrimary: false,
        columns: ['external_id'],
      },
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

  it.each([
    {
      name: 'a standalone single-column unique index',
      columns: [columnRow('email', 1, { is_unique: true })],
      constraints: [
        constraintRow('orders_email_idx', 'i', 'email', 'UNIQUE (email)'),
      ],
      expected: [
        {
          name: 'orders_email_idx',
          isPrimary: false,
          columns: ['email'],
        },
      ],
    },
    {
      name: 'a standalone composite unique index in index key order',
      columns: [columnRow('tenant_id', 1), columnRow('external_id', 2)],
      constraints: [
        constraintRow(
          'orders_tenant_external_idx',
          'i',
          'external_id',
          'UNIQUE (tenant_id, external_id)',
        ),
        constraintRow(
          'orders_tenant_external_idx',
          'i',
          'tenant_id',
          'UNIQUE (tenant_id, external_id)',
        ),
      ],
      expected: [
        {
          name: 'orders_tenant_external_idx',
          isPrimary: false,
          columns: ['tenant_id', 'external_id'],
        },
      ],
    },
    {
      name: 'a constraint-backed index exactly once with the constraint winning',
      columns: [columnRow('tenant_id', 1), columnRow('email', 2)],
      constraints: [
        constraintRow(
          'orders_email_key',
          'i',
          'tenant_id',
          'UNIQUE (tenant_id, email)',
        ),
        constraintRow('orders_email_key', 'u', 'email', 'UNIQUE (email)'),
      ],
      expected: [
        {
          name: 'orders_email_key',
          isPrimary: false,
          columns: ['email'],
        },
      ],
    },
  ])(
    'returns $name as a candidate key',
    ({ columns, constraints, expected }) => {
      const result = normalizeTableConstraints(
        columns.map((column) => JSON.stringify(column)),
        constraints.map((constraint) => JSON.stringify(constraint)),
        'public',
      );

      expect(result.candidateKeys).toEqual(expected);
    },
  );

  it.each(['partial', 'expression'])(
    'does not return a %s unique index omitted by introspection',
    () => {
      const result = normalizeTableConstraints(
        [JSON.stringify(columnRow('email', 1, { is_unique: true }))],
        [
          JSON.stringify(
            constraintRow(
              'orders_email_fkey',
              'f',
              'email',
              'FOREIGN KEY (email) REFERENCES owners(email) ON UPDATE NO ACTION ON DELETE NO ACTION',
            ),
          ),
        ],
        'public',
      );

      expect(result.candidateKeys).toEqual([]);
      expect(result.foreignKeyRelations[0].oneToOne).toBe(false);
    },
  );
});
