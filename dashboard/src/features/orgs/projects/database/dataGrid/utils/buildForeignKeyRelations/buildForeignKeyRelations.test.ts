import {
  buildForeignKeyRelations,
  type RawTableConstraint,
} from '@/features/orgs/projects/database/dataGrid/utils/buildForeignKeyRelations';

const COMPOSITE_DEFINITION =
  'FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id) ON UPDATE CASCADE ON DELETE RESTRICT';

function foreignKeyRows(
  name: string,
  definition: string,
  columns: string[],
): RawTableConstraint[] {
  return columns.map((column, index) => ({
    constraint_name: name,
    constraint_type: 'f',
    constraint_definition: definition,
    column_name: column,
    column_ordinality: index + 1,
  }));
}

describe('buildForeignKeyRelations', () => {
  it('deduplicates composite rows and decorates every participant with the same relation object', () => {
    const rows = foreignKeyRows('orders_account_fkey', COMPOSITE_DEFINITION, [
      'tenant_id',
      'account_id',
    ]);
    const result = buildForeignKeyRelations([...rows, rows[0], rows[1]], 'app');

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
    const [relation] = result.foreignKeyRelations;
    expect(result.foreignKeyRelationsByColumn.get('tenant_id')).toBe(relation);
    expect(result.foreignKeyRelationsByColumn.get('account_id')).toBe(relation);
  });

  it('uses exact complete key equality for cardinality', () => {
    const rows = [
      ...foreignKeyRows('orders_account_fkey', COMPOSITE_DEFINITION, [
        'tenant_id',
        'account_id',
      ]),
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

    const result = buildForeignKeyRelations(rows, 'app');

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
        'app',
      ).foreignKeyRelations[0]?.oneToOne,
    ).toBe(false);
  });

  it('preserves candidate ordinality, kinds, and editable unique constraints', () => {
    const result = buildForeignKeyRelations(
      [
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
      ],
      'app',
    );

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

  it('rejects missing ordinality and parsed/catalog ordinality disagreement', () => {
    const missingOrdinality = foreignKeyRows(
      'missing_fkey',
      COMPOSITE_DEFINITION,
      ['tenant_id', 'account_id'],
    ).map((row) => ({ ...row, column_ordinality: undefined }));
    const disagreeing = foreignKeyRows(
      'disagreeing_fkey',
      COMPOSITE_DEFINITION,
      ['account_id', 'tenant_id'],
    );

    const result = buildForeignKeyRelations(
      [...missingOrdinality, ...disagreeing],
      'app',
    );

    expect(result.foreignKeyRelations).toEqual([]);
  });

  it('is stable under shuffled input and picks compatibility by relation name then local ordinality', () => {
    const alphaRows = foreignKeyRows(
      'alpha_fkey',
      'FOREIGN KEY (shared_id) REFERENCES alpha(id)',
      ['shared_id'],
    );
    const betaRows = foreignKeyRows(
      'beta_fkey',
      'FOREIGN KEY (other_id, shared_id) REFERENCES beta(other_id, id)',
      ['other_id', 'shared_id'],
    );
    const constraints = [...betaRows, ...alphaRows];
    const forward = buildForeignKeyRelations(constraints, 'app');
    const reverse = buildForeignKeyRelations([...constraints].reverse(), 'app');

    expect(reverse.foreignKeyRelations).toEqual(forward.foreignKeyRelations);
    expect(forward.foreignKeyRelationsByColumn.get('shared_id')).toBe(
      forward.foreignKeyRelations[0],
    );
    expect(reverse.foreignKeyRelationsByColumn.get('shared_id')).toBe(
      reverse.foreignKeyRelations[0],
    );
    expect(forward.foreignKeyRelations.map(({ name }) => name)).toEqual([
      'alpha_fkey',
      'beta_fkey',
    ]);
  });

  it('rejects ambiguous candidate ordinality instead of producing a partial key', () => {
    const result = buildForeignKeyRelations(
      [
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
      ],
      'app',
    );

    expect(result.candidateKeys).toEqual([]);
    expect(result.constraintColumnSets).toEqual([]);
  });
});
