import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import useCreateRemoteRelationshipMutation from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation/useCreateRemoteRelationshipMutation';
import { getSuggestRelationshipsQueryKey } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { act, renderHook, waitFor } from '@/tests/testUtils';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const mocks = vi.hoisted(() => ({
  createRemoteRelationship: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation/createRemoteRelationship',
  () => ({ default: mocks.createRemoteRelationship }),
);

const variables = {
  resourceVersion: 1,
  args: {
    name: 'remote_parent',
    source: 'default',
    table: { schema: 'public', name: 'child' },
    definition: {
      to_source: {
        source: 'analytics',
        table: { schema: 'public', name: 'parent' },
        relationship_type: 'object' as const,
        field_mapping: { parent_id: 'id' },
      },
    },
  },
};

function createDeferred() {
  let resolve!: (value?: string) => void;
  const promise = new Promise<string>((resolvePromise) => {
    resolve = (value = 'refreshed') => resolvePromise(value);
  });

  return { promise, resolve };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useCreateRemoteRelationshipMutation', () => {
  beforeEach(() => {
    mocks.createRemoteRelationship.mockResolvedValue({ message: 'success' });
    mocks.useProject.mockReturnValue({ project, loading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awaits exact metadata and suggestion refetches before success completes', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);
    const metadataRefetch = createDeferred();
    const suggestionsRefetch = createDeferred();
    const metadataQuery = vi
      .fn()
      .mockResolvedValueOnce('initial metadata')
      .mockImplementationOnce(() => metadataRefetch.promise);
    const suggestionsQuery = vi
      .fn()
      .mockResolvedValueOnce('initial suggestions')
      .mockImplementationOnce(() => suggestionsRefetch.promise);
    const callerOnSuccess = vi.fn();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => {
        useQuery({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
          queryFn: metadataQuery,
        });
        useQuery({
          queryKey: getSuggestRelationshipsQueryKey('default'),
          queryFn: suggestionsQuery,
        });

        return useCreateRemoteRelationshipMutation({
          mutationOptions: { onSuccess: callerOnSuccess },
        });
      },
      { wrapper },
    );

    await waitFor(() => {
      expect(metadataQuery).toHaveBeenCalledOnce();
      expect(suggestionsQuery).toHaveBeenCalledOnce();
    });

    let mutationPromise!: ReturnType<typeof result.current.mutateAsync>;
    let mutationSettled = false;
    act(() => {
      mutationPromise = result.current.mutateAsync(variables).finally(() => {
        mutationSettled = true;
      });
    });

    await waitFor(() => {
      expect(metadataQuery).toHaveBeenCalledTimes(2);
      expect(suggestionsQuery).toHaveBeenCalledTimes(2);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      exact: true,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getSuggestRelationshipsQueryKey(variables.args.source),
      exact: true,
    });
    expect(callerOnSuccess).not.toHaveBeenCalled();

    metadataRefetch.resolve();
    await Promise.resolve();
    expect(callerOnSuccess).not.toHaveBeenCalled();
    expect(mutationSettled).toBe(false);

    suggestionsRefetch.resolve();
    await mutationPromise;

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(mutationSettled).toBe(true);
  });
});
