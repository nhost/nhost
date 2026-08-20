import { parseTableColumnsAndConstraints } from '@/features/orgs/projects/database/common/utils/parseTableColumnsAndConstraints';

interface ConstraintRowOptions {
  name: string;
  type: 'f' | 'p' | 'u';
  column: string;
  ordinality: number;
  definition?: string;
}

function columnRow(columnName: string, ordinalPosition: number): string {
  return JSON.stringify({
    column_name: columnName,
    ordinal_position: ordinalPosition,
  });
}

function constraintRow({
  name,
  type,
  column,
  ordinality,
  definition,
}: ConstraintRowOptions): string {
  return JSON.stringify({
    constraint_name: name,
    constraint_type: type,
    constraint_definition: definition,
    column_name: column,
    column_ordinality: ordinality,
  });
}

describe('parseTableColumnsAndConstraints', () => {
  it.each([
    'null',
    '[]',
    '"text"',
    '42',
  ])('rejects non-record column metadata %s', (rawColumn) => {
    expect(() =>
      parseTableColumnsAndConstraints([rawColumn], [], 'public'),
    ).toThrow(new Error('The database returned invalid column metadata.'));
  });

  it.each([
    'null',
    '[]',
    '"text"',
    '42',
  ])('rejects non-record constraint metadata %s', (rawConstraint) => {
    expect(() =>
      parseTableColumnsAndConstraints(
        [columnRow('id', 1)],
        [rawConstraint],
        'public',
      ),
    ).toThrow(new Error('The database returned invalid constraint metadata.'));
  });

  it.each([
    {
      description: 'a ghost local column',
      relationName: 'children_ghost_fkey',
      rawColumns: [columnRow('id', 1)],
      constraintColumn: 'ghost_id',
      definition: 'FOREIGN KEY (ghost_id) REFERENCES parents(id)',
      presentLocalColumn: undefined,
    },
    {
      description: 'a malformed definition',
      relationName: 'children_malformed_fkey',
      rawColumns: [columnRow('id', 1), columnRow('parent_id', 2)],
      constraintColumn: 'parent_id',
      definition: 'not a foreign key constraint',
      presentLocalColumn: 'parent_id',
    },
    {
      description: 'an empty referenced table endpoint',
      relationName: 'children_empty_table_fkey',
      rawColumns: [columnRow('id', 1), columnRow('parent_id', 2)],
      constraintColumn: 'parent_id',
      definition: 'FOREIGN KEY (parent_id) REFERENCES ""(id)',
      presentLocalColumn: 'parent_id',
    },
    {
      description: 'an empty referenced column endpoint',
      relationName: 'children_empty_column_fkey',
      rawColumns: [columnRow('id', 1), columnRow('parent_id', 2)],
      constraintColumn: 'parent_id',
      definition: 'FOREIGN KEY (parent_id) REFERENCES parents("")',
      presentLocalColumn: 'parent_id',
    },
  ])('excludes relations with $description', (testCase) => {
    const result = parseTableColumnsAndConstraints(
      testCase.rawColumns,
      [
        constraintRow({
          name: testCase.relationName,
          type: 'f',
          column: testCase.constraintColumn,
          ordinality: 1,
          definition: testCase.definition,
        }),
      ],
      'public',
    );

    expect(
      result.foreignKeyRelations.find(
        (relation) => relation.name === testCase.relationName,
      ),
    ).toBeUndefined();
    result.columns.forEach((column) => {
      expect(column.foreign_key_relation?.name).not.toBe(testCase.relationName);
    });

    if (testCase.presentLocalColumn) {
      expect(
        result.columns.find(
          (column) => column.column_name === testCase.presentLocalColumn,
        )?.foreign_key_relation,
      ).toBeNull();
    }
  });

  it('propagates the caller schema only to unqualified references', () => {
    const result = parseTableColumnsAndConstraints(
      [columnRow('parent_id', 1), columnRow('auth_parent_id', 2)],
      [
        constraintRow({
          name: 'children_auth_parent_fkey',
          type: 'f',
          column: 'auth_parent_id',
          ordinality: 1,
          definition:
            'FOREIGN KEY (auth_parent_id) REFERENCES auth.parents(id)',
        }),
        constraintRow({
          name: 'children_parent_fkey',
          type: 'f',
          column: 'parent_id',
          ordinality: 1,
          definition: 'FOREIGN KEY (parent_id) REFERENCES parents(id)',
        }),
      ],
      'app',
    );

    expect(result.foreignKeyRelations).toEqual([
      {
        name: 'children_auth_parent_fkey',
        columns: ['auth_parent_id'],
        referencedSchema: 'auth',
        referencedTable: 'parents',
        referencedColumns: ['id'],
        updateAction: 'NO ACTION',
        deleteAction: 'NO ACTION',
        oneToOne: false,
      },
      {
        name: 'children_parent_fkey',
        columns: ['parent_id'],
        referencedSchema: 'app',
        referencedTable: 'parents',
        referencedColumns: ['id'],
        updateAction: 'NO ACTION',
        deleteAction: 'NO ACTION',
        oneToOne: false,
      },
    ]);
    expect(result.columns[0].foreign_key_relation).toBe(
      result.foreignKeyRelations[1],
    );
    expect(result.columns[1].foreign_key_relation).toBe(
      result.foreignKeyRelations[0],
    );
  });

  it('returns deterministic ordered singular and composite output from shuffled catalog rows', () => {
    const compositeRelation = {
      name: 'orders_account_fkey',
      columns: ['tenant_id', 'account_id'],
      referencedSchema: 'app',
      referencedTable: 'accounts',
      referencedColumns: ['tenant_id', 'id'],
      updateAction: 'CASCADE',
      deleteAction: 'RESTRICT',
      oneToOne: true,
    } as const;
    const singularRelation = {
      name: 'orders_owner_fkey',
      columns: ['owner_id'],
      referencedSchema: 'auth',
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'NO ACTION',
      deleteAction: 'SET NULL',
      oneToOne: false,
    } as const;
    const compositeDefinition =
      'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT';

    const result = parseTableColumnsAndConstraints(
      [
        columnRow('account_id', 3),
        columnRow('owner_id', 4),
        columnRow('id', 1),
        columnRow('tenant_id', 2),
      ],
      [
        constraintRow({
          name: 'orders_account_fkey',
          type: 'f',
          column: 'account_id',
          ordinality: 2,
          definition: compositeDefinition,
        }),
        constraintRow({
          name: 'orders_owner_fkey',
          type: 'f',
          column: 'owner_id',
          ordinality: 1,
          definition:
            'FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL',
        }),
        constraintRow({
          name: 'orders_tenant_account_key',
          type: 'u',
          column: 'account_id',
          ordinality: 2,
        }),
        constraintRow({
          name: 'orders_pkey',
          type: 'p',
          column: 'id',
          ordinality: 1,
        }),
        constraintRow({
          name: 'orders_account_fkey',
          type: 'f',
          column: 'tenant_id',
          ordinality: 1,
          definition: compositeDefinition,
        }),
        constraintRow({
          name: 'orders_tenant_account_key',
          type: 'u',
          column: 'tenant_id',
          ordinality: 1,
        }),
      ],
      'app',
    );

    expect(result.foreignKeyRelations).toEqual([
      compositeRelation,
      singularRelation,
    ]);
    expect(result.candidateKeys).toEqual([
      {
        id: '["primaryKey","orders_pkey"]',
        name: 'orders_pkey',
        kind: 'primaryKey',
        columns: ['id'],
      },
      {
        id: '["uniqueConstraint","orders_tenant_account_key"]',
        name: 'orders_tenant_account_key',
        kind: 'uniqueConstraint',
        columns: ['tenant_id', 'account_id'],
      },
    ]);
    expect(result.uniqueConstraints).toEqual([
      {
        id: '["uniqueConstraint","orders_tenant_account_key"]',
        originalName: 'orders_tenant_account_key',
        name: 'orders_tenant_account_key',
        columns: ['tenant_id', 'account_id'],
      },
    ]);
    expect(result.constraintColumnSets).toEqual([
      ['id'],
      ['tenant_id', 'account_id'],
    ]);
    expect(
      result.columns.map(
        ({
          column_name,
          ordinal_position,
          unique_constraints,
          primary_constraints,
        }) => ({
          column_name,
          ordinal_position,
          unique_constraints,
          primary_constraints,
        }),
      ),
    ).toEqual([
      {
        column_name: 'id',
        ordinal_position: 1,
        unique_constraints: [],
        primary_constraints: ['orders_pkey'],
      },
      {
        column_name: 'tenant_id',
        ordinal_position: 2,
        unique_constraints: ['orders_tenant_account_key'],
        primary_constraints: [],
      },
      {
        column_name: 'account_id',
        ordinal_position: 3,
        unique_constraints: ['orders_tenant_account_key'],
        primary_constraints: [],
      },
      {
        column_name: 'owner_id',
        ordinal_position: 4,
        unique_constraints: [],
        primary_constraints: [],
      },
    ]);
    expect(result.columns[0].foreign_key_relation).toBeNull();
    expect(result.columns[1].foreign_key_relation).toBe(
      result.foreignKeyRelations[0],
    );
    expect(result.columns[2].foreign_key_relation).toBe(
      result.foreignKeyRelations[0],
    );
    expect(result.columns[3].foreign_key_relation).toBe(
      result.foreignKeyRelations[1],
    );
  });
});
