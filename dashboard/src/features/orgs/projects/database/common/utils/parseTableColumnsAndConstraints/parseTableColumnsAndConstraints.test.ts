import { parseTableColumnsAndConstraints } from '@/features/orgs/projects/database/common/utils/parseTableColumnsAndConstraints';
import { buildDefaultOrderByClause } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/buildDefaultOrderByClause';

interface ConstraintRowOptions {
  name: string;
  type: 'f' | 'p' | 'u';
  column: string;
  ordinality: number;
  isReferenceable?: boolean;
  referencedSchema?: string;
  referencedTable?: string;
  referencedColumn?: string;
  updateActionCode?: string;
  deleteActionCode?: string;
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
  isReferenceable,
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
    is_referenceable: isReferenceable,
    referenced_schema:
      referencedSchema ?? (type === 'f' ? 'public' : undefined),
    referenced_table: type === 'f' ? (referencedTable ?? 'parents') : undefined,
    referenced_column_name:
      type === 'f' ? (referencedColumn ?? 'id') : undefined,
    update_action_code: type === 'f' ? (updateActionCode ?? 'a') : undefined,
    delete_action_code: type === 'f' ? (deleteActionCode ?? 'a') : undefined,
  });
}

describe('parseTableColumnsAndConstraints', () => {
  it.each([
    'null',
    '[]',
    '"text"',
    '42',
  ])('rejects non-record column metadata %s', (rawColumn) => {
    expect(() => parseTableColumnsAndConstraints([rawColumn], [])).toThrow(
      new Error('The database returned invalid column metadata.'),
    );
  });

  it.each([
    'null',
    '[]',
    '"text"',
    '42',
  ])('rejects non-record constraint metadata %s', (rawConstraint) => {
    expect(() =>
      parseTableColumnsAndConstraints([columnRow('id', 1)], [rawConstraint]),
    ).toThrow(new Error('The database returned invalid constraint metadata.'));
  });

  it.each([
    {
      description: 'a ghost local column',
      relationName: 'children_ghost_fkey',
      rawColumns: [columnRow('id', 1)],
      constraintColumn: 'ghost_id',
      constraintOverrides: {},
      presentLocalColumn: undefined,
    },
    {
      description: 'an unknown referential-action code',
      relationName: 'children_malformed_fkey',
      rawColumns: [columnRow('id', 1), columnRow('parent_id', 2)],
      constraintColumn: 'parent_id',
      constraintOverrides: { updateActionCode: '?' },
      presentLocalColumn: 'parent_id',
    },
    {
      description: 'an empty referenced table endpoint',
      relationName: 'children_empty_table_fkey',
      rawColumns: [columnRow('id', 1), columnRow('parent_id', 2)],
      constraintColumn: 'parent_id',
      constraintOverrides: { referencedTable: '' },
      presentLocalColumn: 'parent_id',
    },
    {
      description: 'an empty referenced column endpoint',
      relationName: 'children_empty_column_fkey',
      rawColumns: [columnRow('id', 1), columnRow('parent_id', 2)],
      constraintColumn: 'parent_id',
      constraintOverrides: { referencedColumn: '' },
      presentLocalColumn: 'parent_id',
    },
  ])('excludes relations with $description', (testCase) => {
    const result = parseTableColumnsAndConstraints(testCase.rawColumns, [
      constraintRow({
        name: testCase.relationName,
        type: 'f',
        column: testCase.constraintColumn,
        ordinality: 1,
        ...testCase.constraintOverrides,
      }),
    ]);

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

  it('uses catalog namespaces instead of inferring them from deparsed references', () => {
    const result = parseTableColumnsAndConstraints(
      [columnRow('parent_id', 1), columnRow('auth_parent_id', 2)],
      [
        constraintRow({
          name: 'children_auth_parent_fkey',
          type: 'f',
          column: 'auth_parent_id',
          ordinality: 1,
          referencedSchema: 'auth',
        }),
        constraintRow({
          name: 'children_parent_fkey',
          type: 'f',
          column: 'parent_id',
          ordinality: 1,
          referencedSchema: 'public',
        }),
      ],
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
        referencedSchema: 'public',
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

  it('decorates non-referenceable constraints without exposing candidate keys', () => {
    const result = parseTableColumnsAndConstraints(
      [columnRow('id', 1), columnRow('external_id', 2)],
      [
        constraintRow({
          name: 'orders_pkey',
          type: 'p',
          column: 'id',
          ordinality: 1,
          isReferenceable: false,
        }),
        constraintRow({
          name: 'orders_external_key',
          type: 'u',
          column: 'external_id',
          ordinality: 1,
          isReferenceable: false,
        }),
      ],
    );

    expect(result.columns[0].primary_constraints).toEqual(['orders_pkey']);
    expect(result.columns[1].unique_constraints).toEqual([
      'orders_external_key',
    ]);
    expect(result.candidateKeys).toEqual([]);
    expect(result.constraintColumnSets).toEqual([]);
    expect(result.uniqueConstraints).toEqual([
      {
        id: '["uniqueConstraint","orders_external_key"]',
        originalName: 'orders_external_key',
        name: 'orders_external_key',
        columns: ['external_id'],
        nullsNotDistinct: false,
      },
    ]);
    expect(buildDefaultOrderByClause(result.columns)).toBe('ORDER BY id ASC');
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
          referencedSchema: 'app',
          referencedTable: 'accounts',
          referencedColumn: 'id',
          updateActionCode: 'c',
          deleteActionCode: 'r',
        }),
        constraintRow({
          name: 'orders_owner_fkey',
          type: 'f',
          column: 'owner_id',
          ordinality: 1,
          referencedSchema: 'auth',
          referencedTable: 'users',
          referencedColumn: 'id',
          deleteActionCode: 'n',
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
          referencedSchema: 'app',
          referencedTable: 'accounts',
          referencedColumn: 'tenant_id',
          updateActionCode: 'c',
          deleteActionCode: 'r',
        }),
        constraintRow({
          name: 'orders_tenant_account_key',
          type: 'u',
          column: 'tenant_id',
          ordinality: 1,
        }),
      ],
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
        nullsNotDistinct: false,
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
