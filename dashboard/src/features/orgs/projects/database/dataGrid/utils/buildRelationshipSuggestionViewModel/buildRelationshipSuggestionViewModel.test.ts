import { buildLocalRelationshipViewModel } from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel';
import { buildRelationshipStructuralKey } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';
import { buildRelationshipSuggestionViewModel } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipSuggestionViewModel';
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
  it('builds a realistic Hasura suggestion with complete ordered identity', () => {
    const hasuraSuggestionPayload: SuggestedObjectRelationship = {
      type: 'object',
      from: {
        table: { schema: 'billing', name: 'invoice_items' },
        columns: ['tenant_id', 'invoice_id'],
      },
      to: {
        table: { schema: 'billing', name: 'invoices' },
        columns: ['tenant_id', 'id'],
      },
    };

    expect(
      buildSuggestion(hasuraSuggestionPayload, new Set(), 'analytics'),
    ).toEqual({
      key: '["Object","analytics",["billing","invoice_items"],["billing","invoices"],[["invoice_id","id"],["tenant_id","tenant_id"]]]',
      name: 'invoice',
      source: 'analytics',
      type: 'Object',
      from: 'billing.invoice_items / tenant_id, invoice_id',
      to: 'billing.invoices / tenant_id, id',
      columnPairs: [
        { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
        { fromColumn: 'invoice_id', toColumn: 'id' },
      ],
      rawSuggestion: hasuraSuggestionPayload,
    });
  });

  it('deduplicates reordered whole pairs using the canonical tracked key', () => {
    const trackedKey = buildTrackedKey();

    const result = buildSuggestion(
      compositeObjectSuggestion,
      new Set(trackedKey ? [trackedKey] : []),
    );

    expect(result).toBeNull();
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
      from: {
        table: { schema: 'public', name: 'child' },
        columns: ['parent_code', 'parent_code'],
      },
      to: {
        table: { schema: 'public', name: 'parent' },
        columns: ['code', 'tenant_id'],
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
});
