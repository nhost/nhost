import {
  buildForeignKeyRelations,
  type RawTableConstraint,
} from '@/features/orgs/projects/database/dataGrid/utils/buildForeignKeyRelations';

interface ForeignKeyRowsOptions {
  columns: string[];
  referencedColumns: string[];
  referencedTable: string;
  referencedSchema?: string;
  updateActionCode?: string;
  deleteActionCode?: string;
}

const COMPOSITE_RELATION: ForeignKeyRowsOptions = {
  columns: ['tenant_id', 'account_id'],
  referencedColumns: ['tenant_id', 'id'],
  referencedTable: 'accounts',
  updateActionCode: 'c',
  deleteActionCode: 'r',
};

function foreignKeyRows(
  name: string,
  {
    columns,
    referencedColumns,
    referencedTable,
    referencedSchema = 'app',
    updateActionCode = 'a',
    deleteActionCode = 'a',
  }: ForeignKeyRowsOptions,
): RawTableConstraint[] {
  return columns.map((column, index) => ({
    constraint_name: name,
    constraint_type: 'f',
    column_name: column,
    column_ordinality: index + 1,
    referenced_schema: referencedSchema,
    referenced_table: referencedTable,
    referenced_column_name: referencedColumns[index],
    update_action_code: updateActionCode,
    delete_action_code: deleteActionCode,
  }));
}

describe('buildForeignKeyRelations', () => {
  it('deduplicates composite rows', () => {
    const rows = foreignKeyRows('orders_account_fkey', COMPOSITE_RELATION);
    const result = buildForeignKeyRelations([...rows, rows[0], rows[1]]);

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
    ]);
  });

  it('uses catalog action codes when DDL contains quoted action-like columns', () => {
    const rows = foreignKeyRows('quoted_action_words_fkey', {
      columns: ['ON UPDATE CASCADE', 'tenant_id'],
      referencedColumns: ['x', 'y'],
      referencedTable: 'parent',
      updateActionCode: 'a',
      deleteActionCode: 'n',
    }).map((row) => ({
      ...row,
      constraint_definition:
        'FOREIGN KEY ("ON UPDATE CASCADE", tenant_id) REFERENCES parent(x, y) ON DELETE SET NULL ("ON UPDATE CASCADE")',
    }));

    expect(buildForeignKeyRelations(rows).foreignKeyRelations).toEqual([
      {
        name: 'quoted_action_words_fkey',
        columns: ['ON UPDATE CASCADE', 'tenant_id'],
        referencedSchema: 'app',
        referencedTable: 'parent',
        referencedColumns: ['x', 'y'],
        updateAction: 'NO ACTION',
        deleteAction: 'SET NULL',
        oneToOne: false,
      },
    ]);
  });

  it('uses the catalog namespace for an unqualified cross-schema reference', () => {
    const result = buildForeignKeyRelations(
      foreignKeyRows('children_parent_fkey', {
        columns: ['parent_id'],
        referencedSchema: 'public',
        referencedTable: 'parents',
        referencedColumns: ['id'],
      }),
    );

    expect(result.foreignKeyRelations[0]?.referencedSchema).toBe('public');
    expect(
      buildForeignKeyRelations(
        foreignKeyRows('children_parent_fkey', {
          columns: ['parent_id'],
          referencedTable: 'parents',
          referencedColumns: ['id'],
        }).map((row) => ({ ...row, referenced_schema: undefined })),
      ).foreignKeyRelations,
    ).toEqual([]);
  });

  it('uses complete candidate-key subsets for cardinality', () => {
    const rows = [
      ...foreignKeyRows('orders_account_fkey', COMPOSITE_RELATION),
      {
        constraint_name: 'orders_tenant_account_key',
        constraint_type: 'u',
        column_name: 'account_id',
        column_ordinality: 2,
      },
      {
        constraint_name: 'orders_tenant_account_key',
        constraint_type: 'u',
        column_name: 'tenant_id',
        column_ordinality: 1,
      },
      {
        constraint_name: 'tenant_only_idx',
        constraint_type: 'i',
        column_name: 'tenant_id',
        column_ordinality: 1,
      },
    ] satisfies RawTableConstraint[];

    const result = buildForeignKeyRelations(rows);

    expect(result.foreignKeyRelations[0]?.oneToOne).toBe(true);
    expect(result.constraintColumnSets).toEqual([
      ['tenant_id', 'account_id'],
      ['tenant_id'],
    ]);
    expect(
      buildForeignKeyRelations(
        rows.filter(
          ({ constraint_name: name }) => name !== 'orders_tenant_account_key',
        ),
      ).foreignKeyRelations[0]?.oneToOne,
    ).toBe(true);
  });

  it('preserves candidate ordinality, kinds, and editable unique constraints', () => {
    const result = buildForeignKeyRelations([
      {
        constraint_name: 'orders_pkey',
        constraint_type: 'p',
        column_name: 'id',
        column_ordinality: 1,
      },
      {
        constraint_name: 'orders_tenant_external_key',
        constraint_type: 'u',
        column_name: 'external_id',
        column_ordinality: 2,
        nulls_not_distinct: true,
      },
      {
        constraint_name: 'orders_tenant_external_key',
        constraint_type: 'u',
        column_name: 'tenant_id',
        column_ordinality: 1,
        nulls_not_distinct: true,
      },
      {
        constraint_name: 'orders_slug_idx',
        constraint_type: 'i',
        column_name: 'slug',
        column_ordinality: 1,
      },
    ]);

    expect(
      result.candidateKeys.map(({ name, kind, columns }) => ({
        name,
        kind,
        columns,
      })),
    ).toEqual([
      { name: 'orders_pkey', kind: 'primaryKey', columns: ['id'] },
      {
        name: 'orders_tenant_external_key',
        kind: 'uniqueConstraint',
        columns: ['tenant_id', 'external_id'],
      },
      {
        name: 'orders_slug_idx',
        kind: 'standaloneUniqueIndex',
        columns: ['slug'],
      },
    ]);
    expect(result.uniqueConstraints).toEqual([
      {
        id: JSON.stringify(['uniqueConstraint', 'orders_tenant_external_key']),
        originalName: 'orders_tenant_external_key',
        name: 'orders_tenant_external_key',
        columns: ['tenant_id', 'external_id'],
        nullsNotDistinct: true,
      },
    ]);
    expect(result.uniqueConstraintsByColumn.get('tenant_id')).toEqual([
      'orders_tenant_external_key',
    ]);
  });

  it('uses only key-attribute rows from UNIQUE constraints with INCLUDE columns', () => {
    const result = buildForeignKeyRelations([
      {
        constraint_name: 'orders_a_key',
        constraint_type: 'u',
        column_name: 'a',
        column_ordinality: 1,
        is_referenceable: true,
      },
    ]);

    expect(result.candidateKeys[0]?.columns).toEqual(['a']);
    expect(result.uniqueConstraints[0]?.columns).toEqual(['a']);
  });

  it('rejects missing or ambiguous catalog ordinality', () => {
    const missingOrdinality = foreignKeyRows(
      'missing_fkey',
      COMPOSITE_RELATION,
    ).map((row) => ({ ...row, column_ordinality: undefined }));
    const ambiguousOrdinality = foreignKeyRows(
      'ambiguous_fkey',
      COMPOSITE_RELATION,
    ).map((row) => ({ ...row, column_ordinality: 1 }));

    const result = buildForeignKeyRelations([
      ...missingOrdinality,
      ...ambiguousOrdinality,
    ]);

    expect(result.foreignKeyRelations).toEqual([]);
  });

  it('is stable under shuffled input and orders relations by name', () => {
    const alphaRows = foreignKeyRows('alpha_fkey', {
      columns: ['shared_id'],
      referencedTable: 'alpha',
      referencedColumns: ['id'],
    });
    const betaRows = foreignKeyRows('beta_fkey', {
      columns: ['other_id', 'shared_id'],
      referencedTable: 'beta',
      referencedColumns: ['other_id', 'id'],
    });
    const constraints = [...betaRows, ...alphaRows];
    const forward = buildForeignKeyRelations(constraints);
    const reverse = buildForeignKeyRelations([...constraints].reverse());

    expect(reverse.foreignKeyRelations).toEqual(forward.foreignKeyRelations);
    expect(forward.foreignKeyRelations.map(({ name }) => name)).toEqual([
      'alpha_fkey',
      'beta_fkey',
    ]);
  });

  it('keeps non-referenceable constraints as declarations but not candidate keys', () => {
    const result = buildForeignKeyRelations([
      {
        constraint_name: 'orders_pkey',
        constraint_type: 'p',
        column_name: 'id',
        column_ordinality: 1,
        is_referenceable: false,
      },
      {
        constraint_name: 'orders_external_key',
        constraint_type: 'u',
        column_name: 'external_id',
        column_ordinality: 1,
        is_referenceable: false,
      },
    ]);

    expect(result.candidateKeys).toEqual([]);
    expect(result.constraintColumnSets).toEqual([]);
    expect(result.primaryConstraintsByColumn.get('id')).toEqual([
      'orders_pkey',
    ]);
    expect(result.uniqueConstraintsByColumn.get('external_id')).toEqual([
      'orders_external_key',
    ]);
    expect(result.uniqueConstraints).toEqual([
      {
        id: '["uniqueConstraint","orders_external_key"]',
        originalName: 'orders_external_key',
        name: 'orders_external_key',
        columns: ['external_id'],
        nullsNotDistinct: false,
      },
    ]);
  });

  it('rejects ambiguous candidate ordinality instead of producing a partial key', () => {
    const result = buildForeignKeyRelations([
      {
        constraint_name: 'broken_key',
        constraint_type: 'u',
        column_name: 'a',
        column_ordinality: 1,
      },
      {
        constraint_name: 'broken_key',
        constraint_type: 'u',
        column_name: 'b',
        column_ordinality: 1,
      },
    ]);

    expect(result.candidateKeys).toEqual([]);
    expect(result.constraintColumnSets).toEqual([]);
  });
});
