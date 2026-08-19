import buildLocalRelationshipViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel/buildLocalRelationshipViewModel';
import buildRelationshipStructuralKey from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey/buildRelationshipStructuralKey';
import buildRelationshipSuggestionViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipSuggestionViewModel/buildRelationshipSuggestionViewModel';
import type {
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

const compositeObjectSuggestion: SuggestedObjectRelationship = {
  type: 'object',
  from: {
    table: { schema: 'public', name: 'child' },
    columns: ['tenant_id', 'parent_code'],
  },
  to: {
    table: { schema: 'public', name: 'parent' },
    columns: ['tenant_id', 'code'],
  },
};

function buildSuggestion(
  suggestion: SuggestedObjectRelationship | SuggestedArrayRelationship,
  existingRelationshipKeys = new Set<string>(),
  dataSource = 'default',
) {
  return buildRelationshipSuggestionViewModel({
    suggestion,
    tableSchema: 'public',
    tableName: 'child',
    dataSource,
    existingRelationshipKeys,
  });
}

function buildTrackedKey(
  overrides: Partial<Parameters<typeof buildRelationshipStructuralKey>[0]> = {},
) {
  return buildRelationshipStructuralKey({
    type: 'Object',
    source: 'default',
    from: { schema: 'public', table: 'child' },
    to: { schema: 'public', table: 'parent' },
    columnPairs: [
      { fromColumn: 'parent_code', toColumn: 'code' },
      { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
    ],
    ...overrides,
  });
}

describe('buildRelationshipSuggestionViewModel', () => {
  it('deduplicates reordered whole pairs using the canonical tracked key', () => {
    const trackedKey = buildTrackedKey();

    const result = buildSuggestion(
      compositeObjectSuggestion,
      new Set(trackedKey ? [trackedKey] : []),
    );

    expect(result).toBeNull();
  });

  it('retains a crossed composite mapping', () => {
    const trackedKey = buildTrackedKey();
    const result = buildSuggestion(
      {
        ...compositeObjectSuggestion,
        to: {
          ...compositeObjectSuggestion.to,
          columns: ['code', 'tenant_id'],
        },
      },
      new Set(trackedKey ? [trackedKey] : []),
    );

    const uncrossed = buildSuggestion(compositeObjectSuggestion);

    expect(result).not.toBeNull();
    expect(result?.key).not.toBe(uncrossed?.key);
    expect(result?.from).toBe('public.child / tenant_id, parent_code');
    expect(result?.to).toBe('public.parent / code, tenant_id');
    expect(result?.columnPairs).toEqual([
      { fromColumn: 'tenant_id', toColumn: 'code' },
      { fromColumn: 'parent_code', toColumn: 'tenant_id' },
    ]);
  });

  it('deduplicates a single-column suggestion', () => {
    const trackedKey = buildRelationshipStructuralKey({
      type: 'Object',
      source: 'default',
      from: { schema: 'public', table: 'child' },
      to: { schema: 'public', table: 'parent' },
      columnPairs: [{ fromColumn: 'parent_code', toColumn: 'code' }],
    });

    const result = buildSuggestion(
      {
        type: 'object',
        from: {
          table: { schema: 'public', name: 'child' },
          columns: ['parent_code'],
        },
        to: {
          table: { schema: 'public', name: 'parent' },
          columns: ['code'],
        },
      },
      new Set(trackedKey ? [trackedKey] : []),
    );

    expect(result).toBeNull();
  });

  it.each([
    ['source', buildTrackedKey({ source: 'other' }), 'default'],
    ['type', buildTrackedKey({ type: 'Array' }), 'default'],
    [
      'from endpoint',
      buildTrackedKey({
        from: { schema: 'other', table: 'child' },
      }),
      'default',
    ],
    [
      'to endpoint',
      buildTrackedKey({
        to: { schema: 'public', table: 'other_parent' },
      }),
      'default',
    ],
  ])('retains suggestions with unrelated %s context', (_, key, dataSource) => {
    const result = buildSuggestion(
      compositeObjectSuggestion,
      new Set(key ? [key] : []),
      dataSource,
    );

    expect(result).not.toBeNull();
  });

  it('does not let a tracked manual array mapping suppress a different FK suggestion', () => {
    const trackedManual = buildLocalRelationshipViewModel({
      relationship: {
        name: 'children_by_other_code',
        using: {
          manual_configuration: {
            remote_table: { schema: 'public', name: 'child' },
            column_mapping: { other_code: 'parent_code' },
          },
        },
      },
      type: 'Array',
      tableSchema: 'public',
      tableName: 'parent',
      dataSource: 'default',
      foreignKeyRelations: [],
    });
    const result = buildSuggestion(
      {
        type: 'array',
        from: {
          table: { schema: 'public', name: 'parent' },
          columns: ['code'],
        },
        to: {
          table: { schema: 'public', name: 'child' },
          columns: ['parent_code'],
        },
      },
      new Set(trackedManual.structuralKey ? [trackedManual.structuralKey] : []),
    );

    expect(result).not.toBeNull();
  });

  it('deduplicates unresolved FK array relationships by fallback identity', () => {
    const trackedForeignKey = buildLocalRelationshipViewModel({
      relationship: {
        name: 'children',
        using: {
          foreign_key_constraint_on: {
            columns: ['parent_code', 'tenant_id'],
            table: { schema: 'public', name: 'child' },
          },
        },
      },
      type: 'Array',
      tableSchema: 'public',
      tableName: 'parent',
      dataSource: 'default',
      foreignKeyRelations: [],
      suggestedRelationships: [],
    });
    const result = buildSuggestion(
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
      new Set(
        trackedForeignKey.structuralKey
          ? [trackedForeignKey.structuralKey]
          : [],
      ),
    );

    expect(result).toBeNull();
  });

  it.each([
    {
      type: 'object' as const,
      from: {
        table: { schema: 'public', name: 'child' },
        columns: ['parent_code', 'tenant_id'],
      },
      to: {
        table: { schema: 'public', name: 'parent' },
        columns: ['code'],
      },
    },
    {
      type: 'object' as const,
      from: { columns: ['parent_code'] },
      to: {
        table: { schema: 'public', name: 'parent' },
        columns: ['code'],
      },
    },
    {
      type: 'object' as const,
      from: {
        table: { schema: 'public', name: 'child' },
        columns: [],
      },
      to: {
        table: { schema: 'public', name: 'parent' },
        columns: [],
      },
    },
    {
      type: 'object' as const,
      from: {
        table: { schema: 'public', name: 'child' },
        columns: ['parent_code', 'parent_code'],
      },
      to: {
        table: { schema: 'public', name: 'parent' },
        columns: ['code', 'tenant_id'],
      },
    },
    {
      type: 'object' as const,
      from: {
        table: { schema: 'public', name: 'child' },
        columns: ['parent_code', 'tenant_id'],
      },
      to: {
        table: { schema: 'public', name: 'parent' },
        columns: ['code', 'code'],
      },
    },
  ])('rejects malformed suggestions', (suggestion) => {
    const trackedKey = buildTrackedKey();
    const result = buildSuggestion(
      suggestion,
      new Set(trackedKey ? [trackedKey] : []),
    );

    expect(result).toBeNull();
  });

  it('does not deduplicate against an absent tracked key', () => {
    const result = buildSuggestion(
      compositeObjectSuggestion,
      new Set<string>(),
    );

    expect(result).not.toBeNull();
  });
});
