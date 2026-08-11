import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import useCreateRelationshipMutation from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRelationshipMutation/useCreateRelationshipMutation';
import {
  getSuggestRelationshipsQueryKey,
  useSuggestRelationshipsQuery,
} from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { act, renderHook, waitFor } from '@/tests/testUtils';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const mocks = vi.hoisted(() => ({
  createRelationship: vi.fn(),
  suggestRelationships: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useCreateRelationshipMutation/createRelationship',
  () => ({ default: mocks.createRelationship }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery/suggestRelationships',
  () => ({ default: mocks.suggestRelationships }),
);

const variables = {
  resourceVersion: 1,
  type: 'pg_create_object_relationship' as const,
  args: {
    source: 'default',
    table: { schema: 'public', name: 'child' },
    name: 'parent',
    using: { foreign_key_constraint_on: ['parent_code', 'tenant_id'] },
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

describe('useCreateRelationshipMutation', () => {
  beforeEach(() => {
    mocks.createRelationship.mockResolvedValue({ message: 'success' });
    mocks.suggestRelationships.mockResolvedValue({ relationships: [] });
    mocks.useProject.mockReturnValue({ project, loading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the normalized source key and requests all suggestions', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    renderHook(() => useSuggestRelationshipsQuery(undefined, undefined), {
      wrapper,
    });

    expect(getSuggestRelationshipsQueryKey()).toEqual([
      'suggest-relationships',
      'default',
    ]);
    expect(
      queryClient.getQueryCache().find({
        queryKey: getSuggestRelationshipsQueryKey(),
        exact: true,
      })?.queryKey,
    ).toEqual(getSuggestRelationshipsQueryKey());
    await waitFor(() => {
      expect(mocks.suggestRelationships).toHaveBeenCalledWith(
        expect.objectContaining({
          args: { source: 'default', omit_tracked: false },
        }),
      );
    });
    expect(mocks.suggestRelationships).not.toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({ omit_tracked: true }),
      }),
    );
  });

  it('awaits both exact active-query refetches before success completes', async () => {
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

        return useCreateRelationshipMutation({
          mutationOptions: { onSuccess: callerOnSuccess },
        });
      },
      { wrapper },
    );

    await waitFor(() => {
      expect(metadataQuery).toHaveBeenCalledTimes(1);
      expect(suggestionsQuery).toHaveBeenCalledTimes(1);
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

  it('routes invalidation rejection through the mutation error lifecycle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);
    const invalidationError = new Error('metadata refresh failed');
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValueOnce(
      invalidationError,
    );
    const callerOnSuccess = vi.fn();
    const callerOnError = vi.fn();
    const { result } = renderHook(
      () =>
        useCreateRelationshipMutation({
          mutationOptions: {
            onError: callerOnError,
            onSuccess: callerOnSuccess,
          },
        }),
      { wrapper },
    );

    await expect(result.current.mutateAsync(variables)).rejects.toBe(
      invalidationError,
    );
    expect(callerOnSuccess).not.toHaveBeenCalled();
    expect(callerOnError).toHaveBeenCalledWith(
      invalidationError,
      variables,
      undefined,
    );
  });

  it('routes caller success rejection through the mutation error lifecycle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);
    const callbackError = new Error('consumer success failed');
    const callerOnError = vi.fn();
    const { result } = renderHook(
      () =>
        useCreateRelationshipMutation({
          mutationOptions: {
            onError: callerOnError,
            onSuccess: vi.fn().mockRejectedValue(callbackError),
          },
        }),
      { wrapper },
    );

    await expect(result.current.mutateAsync(variables)).rejects.toBe(
      callbackError,
    );
    expect(callerOnError).toHaveBeenCalledWith(
      callbackError,
      variables,
      undefined,
    );
  });
});
