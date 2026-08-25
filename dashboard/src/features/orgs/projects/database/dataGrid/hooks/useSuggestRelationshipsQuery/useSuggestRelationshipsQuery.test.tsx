import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import {
  getSuggestRelationshipsQueryKey,
  useSuggestRelationshipsQuery,
} from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { renderHook, waitFor } from '@/tests/testUtils';

const firstProject = {
  subdomain: 'first-project',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'first-secret' } },
};
const secondProject = {
  subdomain: 'second-project',
  region: { name: 'eu-central-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'second-secret' } },
};

const mocks = vi.hoisted(() => ({
  suggestRelationships: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery/suggestRelationships',
  () => ({ default: mocks.suggestRelationships }),
);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useSuggestRelationshipsQuery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses distinct cache entries for projects with the same source', async () => {
    const firstResponse = { relationships: [] };
    const secondResponse = { relationships: [] };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mocks.useProject.mockReturnValue({ project: firstProject, loading: false });
    mocks.suggestRelationships
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    const { result, rerender } = renderHook(
      () => useSuggestRelationshipsQuery('default'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.data).toBe(firstResponse);
    });

    mocks.useProject.mockReturnValue({
      project: secondProject,
      loading: false,
    });
    rerender();

    await waitFor(() => {
      expect(result.current.data).toBe(secondResponse);
    });

    expect(
      queryClient.getQueryData(
        getSuggestRelationshipsQueryKey(firstProject.subdomain, 'default'),
      ),
    ).toBe(firstResponse);
    expect(
      queryClient.getQueryData(
        getSuggestRelationshipsQueryKey(secondProject.subdomain, 'default'),
      ),
    ).toBe(secondResponse);
    expect(mocks.suggestRelationships).toHaveBeenCalledTimes(2);
  });
});
