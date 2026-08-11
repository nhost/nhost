import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import buildLocalRelationshipViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel/buildLocalRelationshipViewModel';
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

  it('fails closed for distinct reverse-array mappings with the same constrained columns', () => {
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
    expect(result.structuralKey).toBeUndefined();
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

  it('keeps rendering fallbacks and omits a key when no reverse match exists', () => {
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
    expect(result.structuralKey).toBeUndefined();
  });
});
