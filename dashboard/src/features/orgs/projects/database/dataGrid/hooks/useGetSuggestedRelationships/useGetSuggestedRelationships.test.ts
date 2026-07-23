import { vi } from 'vitest';
import useGetRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships/useGetRelationships';
import useGetSuggestedRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useGetSuggestedRelationships/useGetSuggestedRelationships';
import { useSuggestRelationshipsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import type {
  LocalRelationshipViewModel,
  RelationshipViewModel,
} from '@/features/orgs/projects/database/dataGrid/types/relationships';
import buildRelationshipStructuralKey from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey/buildRelationshipStructuralKey';
import { renderHook } from '@/tests/testUtils';
import type { SuggestedObjectRelationship } from '@/utils/hasura-api/generated/schemas';

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships/useGetRelationships',
);
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery',
);

const equivalentSuggestion: SuggestedObjectRelationship = {
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

const crossedSuggestion: SuggestedObjectRelationship = {
  ...equivalentSuggestion,
  to: {
    ...equivalentSuggestion.to,
    columns: ['code', 'tenant_id'],
  },
};

const trackedKey = buildRelationshipStructuralKey({
  type: 'Object',
  source: 'default',
  from: { schema: 'public', table: 'child' },
  to: { schema: 'public', table: 'parent' },
  columnPairs: [
    { fromColumn: 'parent_code', toColumn: 'code' },
    { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
  ],
});

const remoteRelationship = {
  kind: 'remote',
  type: 'Remote Schema',
  name: 'remote_parent',
  fromSource: 'default',
  fromLabel: 'public.child / parent_code, tenant_id',
  toLabel: 'crm.parent / code, tenant_id',
  structuralKey: trackedKey,
} as unknown as RelationshipViewModel;

const trackedRelationship: LocalRelationshipViewModel = {
  kind: 'local',
  type: 'Object',
  name: 'parent',
  fromSource: 'default',
  fromLabel: 'public.child / parent_code, tenant_id',
  toLabel: 'public.parent / code, tenant_id',
  structuralKey: trackedKey,
};

function mockRelationships(relationships: RelationshipViewModel[]) {
  vi.mocked(useGetRelationships).mockReturnValue({
    relationships,
    isLoading: false,
    error: null,
  });
}

describe('useGetSuggestedRelationships', () => {
  beforeEach(() => {
    vi.mocked(useSuggestRelationshipsQuery).mockReturnValue({
      data: {
        relationships: [equivalentSuggestion, crossedSuggestion],
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSuggestRelationshipsQuery>);
  });

  it('does not let a tracked relationship without a key suppress a valid suggestion', () => {
    mockRelationships([
      {
        kind: 'local',
        type: 'Object',
        name: 'invalid_relationship',
        fromSource: 'default',
        fromLabel: 'public.child / parent_code',
        toLabel: 'public.parent / code',
      },
    ]);

    const { result } = renderHook(() =>
      useGetSuggestedRelationships({
        dataSource: 'default',
        schema: 'public',
        tableName: 'child',
      }),
    );

    expect(result.current.suggestedRelationships).toHaveLength(2);
  });

  it('removes a refreshed reordered composite match but keeps crossed mappings', () => {
    mockRelationships([remoteRelationship]);
    const { result, rerender } = renderHook(() =>
      useGetSuggestedRelationships({
        dataSource: 'default',
        schema: 'public',
        tableName: 'child',
      }),
    );

    expect(result.current.suggestedRelationships).toHaveLength(2);

    mockRelationships([remoteRelationship, trackedRelationship]);
    rerender();

    expect(result.current.suggestedRelationships).toHaveLength(1);
    expect(result.current.suggestedRelationships?.[0].from).toBe(
      'public.child / tenant_id, parent_code',
    );
    expect(result.current.suggestedRelationships?.[0].to).toBe(
      'public.parent / code, tenant_id',
    );
  });
});
