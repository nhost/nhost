import { vi } from 'vitest';
import useGetRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships/useGetRelationships';
import useGetSuggestedRelationships from '@/features/orgs/projects/database/dataGrid/hooks/useGetSuggestedRelationships/useGetSuggestedRelationships';
import { useSuggestRelationshipsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { renderHook } from '@/tests/testUtils';
import type { SuggestedObjectRelationship } from '@/utils/hasura-api/generated/schemas';

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useGetRelationships/useGetRelationships',
);
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery',
);

const suggestion = {
  type: 'object',
  from: {
    table: { schema: 'public', name: 'orders' },
    columns: ['customer_id'],
  },
  to: {
    table: { schema: 'public', name: 'customers' },
    columns: ['id'],
  },
} as SuggestedObjectRelationship;

describe('useGetSuggestedRelationships', () => {
  it('does not let a tracked relationship without a key suppress a valid suggestion', () => {
    vi.mocked(useSuggestRelationshipsQuery).mockReturnValue({
      data: { relationships: [suggestion] },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSuggestRelationshipsQuery>);
    vi.mocked(useGetRelationships).mockReturnValue({
      relationships: [
        {
          kind: 'local',
          type: 'Object',
          name: 'invalid_relationship',
          fromSource: 'default',
          fromLabel: 'public.orders / customer_id',
          toLabel: 'public.customers / id',
        },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useGetSuggestedRelationships({
        dataSource: 'default',
        schema: 'public',
        tableName: 'orders',
      }),
    );

    expect(result.current.suggestedRelationships).toHaveLength(1);
    expect(result.current.suggestedRelationships?.[0].from).toBe(
      'public.orders / customer_id',
    );
  });
});
