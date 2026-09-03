import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { buildLocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel';
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

  it('resolves the composite array relationship columns form', () => {
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

    expect(composite.fromLabel).toBe('public.parent / code, tenant_id');
    expect(composite.toLabel).toBe('public.child / parent_code, tenant_id');
    expect(composite.structuralKey).toBeDefined();
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

  it('builds manual mappings from entry pairs', () => {
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

    expect(object.fromLabel).toBe('public.child / parent_code, tenant_id');
    expect(object.toLabel).toBe('public.parent / code, tenant_id');
    expect(object.structuralKey).toBeDefined();
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
