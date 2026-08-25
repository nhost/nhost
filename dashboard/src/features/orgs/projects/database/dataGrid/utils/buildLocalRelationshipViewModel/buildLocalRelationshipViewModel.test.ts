import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import buildLocalRelationshipViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel/buildLocalRelationshipViewModel';
import { buildArrayRelationshipRemoteKey } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
  SuggestedArrayRelationship,
} from '@/utils/hasura-api/generated/schemas';

const compositeForeignKey: ForeignKeyRelation = {
  name: 'child_parent_fkey',
  columns: ['tenant_id', 'parent_code'],
  referencedSchema: 'public',
  referencedTable: 'parent',
  referencedColumns: ['tenant_id', 'code'],
  updateAction: 'RESTRICT',
  deleteAction: 'RESTRICT',
};

function buildObject(
  relationship: ObjectRelationshipItem,
  foreignKeyRelations: ForeignKeyRelation[] = [compositeForeignKey],
) {
  return buildLocalRelationshipViewModel({
    relationship,
    type: 'Object',
    tableSchema: 'public',
    tableName: 'child',
    dataSource: 'default',
    foreignKeyRelations,
  });
}

function buildArray(
  relationship: ArrayRelationshipItem,
  suggestedRelationships: SuggestedArrayRelationship[],
) {
  return buildLocalRelationshipViewModel({
    relationship,
    type: 'Array',
    tableSchema: 'public',
    tableName: 'parent',
    dataSource: 'default',
    foreignKeyRelations: [],
    suggestedRelationships,
  });
}

describe('buildLocalRelationshipViewModel', () => {
  it('resolves an object relationship using a string foreign key', () => {
    const result = buildObject(
      {
        name: 'parent',
        using: { foreign_key_constraint_on: 'parent_code' },
      },
      [
        {
          ...compositeForeignKey,
          columns: ['parent_code'],
          referencedColumns: ['code'],
        },
      ],
    );

    expect(result.fromLabel).toBe('public.child / parent_code');
    expect(result.toLabel).toBe('public.parent / code');
    expect(result.structuralKey).toBeDefined();
  });

  it('normalizes a legacy scalar object foreign key', () => {
    const result = buildObject(
      {
        name: 'parent',
        using: { foreign_key_constraint_on: { column: 'parent_code' } },
      } as unknown as ObjectRelationshipItem,
      [
        {
          ...compositeForeignKey,
          columns: ['parent_code'],
          referencedColumns: ['code'],
        },
      ],
    );

    expect(result.columnPairs).toEqual([
      { fromColumn: 'parent_code', toColumn: 'code' },
    ]);
    expect(result.structuralKey).toBeDefined();
  });

  it('aligns whole object foreign-key pairs to metadata column order', () => {
    const result = buildObject({
      name: 'parent',
      using: {
        foreign_key_constraint_on: ['parent_code', 'tenant_id'],
      },
    });

    expect(result.fromLabel).toBe('public.child / parent_code, tenant_id');
    expect(result.toLabel).toBe('public.parent / code, tenant_id');
    expect(result.structuralKey).toBeDefined();
  });

  it('resolves array relationship column and columns forms', () => {
    const singleSuggestion: SuggestedArrayRelationship = {
      type: 'array',
      from: {
        table: { schema: 'public', name: 'parent' },
        columns: ['code'],
      },
      to: {
        table: { schema: 'public', name: 'child' },
        columns: ['parent_code'],
      },
    };
    const single = buildArray(
      {
        name: 'children',
        using: {
          foreign_key_constraint_on: {
            column: 'parent_code',
            table: { schema: 'public', name: 'child' },
          },
        },
      },
      [singleSuggestion],
    );
    const composite = buildArray(
      {
        name: 'children',
        using: {
          foreign_key_constraint_on: {
            columns: ['parent_code', 'tenant_id'],
            table: { schema: 'public', name: 'child' },
          },
        },
      },
      [
        {
          type: 'array',
          from: {
            table: { schema: 'public', name: 'parent' },
            columns: ['tenant_id', 'code'],
          },
          to: {
            table: { schema: 'public', name: 'child' },
            columns: ['tenant_id', 'parent_code'],
          },
        },
      ],
    );

    expect(single.fromLabel).toBe('public.parent / code');
    expect(single.toLabel).toBe('public.child / parent_code');
    expect(single.structuralKey).toBeDefined();
    expect(composite.fromLabel).toBe('public.parent / code, tenant_id');
    expect(composite.toLabel).toBe('public.child / parent_code, tenant_id');
    expect(composite.structuralKey).toBeDefined();
  });

  it('collapses equivalent reordered reverse-array candidates', () => {
    const relationship: ArrayRelationshipItem = {
      name: 'children',
      using: {
        foreign_key_constraint_on: {
          columns: ['parent_code', 'tenant_id'],
          table: { schema: 'public', name: 'child' },
        },
      },
    };
    const candidates: SuggestedArrayRelationship[] = [
      {
        type: 'array',
        from: {
          table: { schema: 'public', name: 'parent' },
          columns: ['code', 'tenant_id'],
        },
        to: {
          table: { schema: 'public', name: 'child' },
          columns: ['parent_code', 'tenant_id'],
        },
      },
      {
        type: 'array',
        from: {
          table: { schema: 'public', name: 'parent' },
          columns: ['tenant_id', 'code'],
        },
        to: {
          table: { schema: 'public', name: 'child' },
          columns: ['tenant_id', 'parent_code'],
        },
      },
    ];

    const result = buildArray(relationship, candidates);

    expect(result.fromLabel).toBe('public.parent / code, tenant_id');
    expect(result.toLabel).toBe('public.child / parent_code, tenant_id');
    expect(result.structuralKey).toBeDefined();
  });

  it('keeps a metadata-derived key while failing closed on ambiguous reverse mappings', () => {
    const relationship: ArrayRelationshipItem = {
      name: 'children',
      using: {
        foreign_key_constraint_on: {
          columns: ['parent_code', 'tenant_id'],
          table: { schema: 'public', name: 'child' },
        },
      },
    };
    const candidates: SuggestedArrayRelationship[] = [
      {
        type: 'array',
        from: {
          table: { schema: 'public', name: 'parent' },
          columns: ['code', 'tenant_id'],
        },
        to: {
          table: { schema: 'public', name: 'child' },
          columns: ['parent_code', 'tenant_id'],
        },
      },
      {
        type: 'array',
        from: {
          table: { schema: 'public', name: 'parent' },
          columns: ['tenant_id', 'code'],
        },
        to: {
          table: { schema: 'public', name: 'child' },
          columns: ['parent_code', 'tenant_id'],
        },
      },
    ];

    const result = buildArray(relationship, candidates);

    expect(result.fromLabel).toBe('public.parent / Not specified');
    expect(result.toLabel).toBe('public.child / parent_code, tenant_id');
    expect(result.structuralKey).toBe(
      buildArrayRelationshipRemoteKey({
        source: 'default',
        from: { schema: 'public', table: 'parent' },
        to: { schema: 'public', table: 'child' },
        remoteColumns: ['parent_code', 'tenant_id'],
      }),
    );
  });

  it('fails closed for duplicate constrained columns', () => {
    const result = buildArray(
      {
        name: 'children',
        using: {
          foreign_key_constraint_on: {
            columns: ['tenant_id', 'tenant_id'],
            table: { schema: 'public', name: 'child' },
          },
        },
      },
      [
        {
          type: 'array',
          from: {
            table: { schema: 'public', name: 'parent' },
            columns: ['code', 'tenant_id'],
          },
          to: {
            table: { schema: 'public', name: 'child' },
            columns: ['tenant_id', 'tenant_id'],
          },
        },
      ],
    );

    expect(result.structuralKey).toBeUndefined();
  });

  it('builds object and array manual mappings from entry pairs', () => {
    const object = buildObject({
      name: 'parent',
      using: {
        manual_configuration: {
          remote_table: { schema: 'public', name: 'parent' },
          column_mapping: {
            parent_code: 'code',
            tenant_id: 'tenant_id',
          },
        },
      },
    });
    const array = buildLocalRelationshipViewModel({
      relationship: {
        name: 'children',
        using: {
          manual_configuration: {
            remote_table: { schema: 'public', name: 'child' },
            column_mapping: {
              code: 'parent_code',
              tenant_id: 'tenant_id',
            },
          },
        },
      },
      type: 'Array',
      tableSchema: 'public',
      tableName: 'parent',
      dataSource: 'default',
      foreignKeyRelations: [],
    });

    expect(object.fromLabel).toBe('public.child / parent_code, tenant_id');
    expect(object.toLabel).toBe('public.parent / code, tenant_id');
    expect(array.fromLabel).toBe('public.parent / code, tenant_id');
    expect(array.toLabel).toBe('public.child / parent_code, tenant_id');
    expect(object.structuralKey).toBeDefined();
    expect(array.structuralKey).toBeDefined();
  });

  it('preserves repeated target columns in manual relationships', () => {
    const relationship = buildObject({
      name: 'parent',
      using: {
        manual_configuration: {
          remote_table: { schema: 'public', name: 'parent' },
          column_mapping: {
            first_parent_id: 'id',
            second_parent_id: 'id',
          },
        },
      },
    });

    expect(relationship.structuralKey).toBeDefined();
    expect(relationship.columnPairs).toEqual([
      { fromColumn: 'first_parent_id', toColumn: 'id' },
      { fromColumn: 'second_parent_id', toColumn: 'id' },
    ]);
  });

  it('keeps permutation-distinct manual array mappings structurally distinct', () => {
    const direct = buildArray(
      {
        name: 'children',
        using: {
          manual_configuration: {
            remote_table: { schema: 'public', name: 'child' },
            column_mapping: {
              code: 'parent_code',
              tenant_id: 'tenant_id',
            },
          },
        },
      },
      [],
    );
    const crossed = buildArray(
      {
        name: 'children_crossed',
        using: {
          manual_configuration: {
            remote_table: { schema: 'public', name: 'child' },
            column_mapping: {
              code: 'tenant_id',
              tenant_id: 'parent_code',
            },
          },
        },
      },
      [],
    );

    expect(direct.structuralKey).toBeDefined();
    expect(crossed.structuralKey).toBeDefined();
    expect(direct.structuralKey).not.toBe(crossed.structuralKey);
  });

  it('gives equivalent manual and foreign-key object mappings the same key', () => {
    const foreignKey = buildObject({
      name: 'parent',
      using: {
        foreign_key_constraint_on: ['parent_code', 'tenant_id'],
      },
    });
    const manual = buildObject({
      name: 'parent_manual',
      using: {
        manual_configuration: {
          remote_table: { schema: 'public', name: 'parent' },
          column_mapping: {
            tenant_id: 'tenant_id',
            parent_code: 'code',
          },
        },
      },
    });

    expect(manual.structuralKey).toBe(foreignKey.structuralKey);
  });

  it('returns no identity for malformed or ambiguous metadata', () => {
    const malformedManual = buildObject({
      name: 'parent',
      using: {
        manual_configuration: {
          remote_table: { schema: 'public', name: 'parent' },
          column_mapping: {
            parent_code: 'id',
            tenant_id: '',
          },
        },
      },
    });
    const ambiguousUsing = buildObject({
      name: 'parent',
      using: {
        foreign_key_constraint_on: ['parent_code', 'tenant_id'],
        manual_configuration: {
          remote_table: { schema: 'public', name: 'parent' },
          column_mapping: { parent_code: 'code', tenant_id: 'tenant_id' },
        },
      },
    } as unknown as ObjectRelationshipItem);
    const missingUsing = buildObject({
      name: 'parent',
    } as unknown as ObjectRelationshipItem);

    expect(malformedManual.structuralKey).toBeUndefined();
    expect(malformedManual.columnPairs).toBeUndefined();
    expect(ambiguousUsing.structuralKey).toBeUndefined();
    expect(ambiguousUsing.columnPairs).toBeUndefined();
    expect(missingUsing.structuralKey).toBeUndefined();
  });

  it('keeps rendering fallbacks and a metadata-derived key when no reverse match exists', () => {
    const result = buildArray(
      {
        name: 'children',
        using: {
          foreign_key_constraint_on: {
            column: 'parent_code',
            table: { schema: 'public', name: 'child' },
          },
        },
      },
      [],
    );

    expect(result.fromLabel).toBe('public.parent / Not specified');
    expect(result.toLabel).toBe('public.child / parent_code');
    expect(result.structuralKey).toBe(
      buildArrayRelationshipRemoteKey({
        source: 'default',
        from: { schema: 'public', table: 'parent' },
        to: { schema: 'public', table: 'child' },
        remoteColumns: ['parent_code'],
      }),
    );
  });
});
