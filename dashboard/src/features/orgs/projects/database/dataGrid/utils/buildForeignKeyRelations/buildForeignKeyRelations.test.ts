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
      },
      {
        constraint_name: 'orders_tenant_external_key',
        constraint_type: 'u',
        column_name: 'tenant_id',
        column_ordinality: 1,
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
      },
    ]);
    expect(result.uniqueConstraintsByColumn.get('tenant_id')).toEqual([
      'orders_tenant_external_key',
    ]);
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
      },
    ]);
  });
});
