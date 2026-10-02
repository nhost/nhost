import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { GetOrganizationsDocument } from '@/generated/graphql';
import { act, renderHook, waitFor } from '@/tests/testUtils';
import useUnpauseApplication from './useUnpauseApplication';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const mocks = vi.hoisted(() => ({
  execPromiseWithErrorToast: vi.fn(),
  refetchQueries: vi.fn(),
  track: vi.fn(),
  unpauseApplication: vi.fn(),
  useAppState: vi.fn(),
  useOrgs: vi.fn(),
  useUnpauseApplicationMutation: vi.fn(),
  useUserData: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQueryClient: () => ({ refetchQueries: mocks.refetchQueries }),
  };
});

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: mocks.useOrgs,
}));

vi.mock('@/features/orgs/utils/execPromiseWithErrorToast', () => ({
  execPromiseWithErrorToast: mocks.execPromiseWithErrorToast,
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...actual,
    useUnpauseApplicationMutation: mocks.useUnpauseApplicationMutation,
  };
});

vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

vi.mock('@/lib/segment', () => ({
  analytics: { track: mocks.track },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: { retry: false },
  },
});

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('useUnpauseApplication', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();

    mocks.useAppState.mockReturnValue({
      project: {
        id: 'project-id',
        subdomain: 'project-subdomain',
      },
    });
    mocks.useOrgs.mockReturnValue({ currentOrg: { id: 'organization-id' } });
    mocks.useUserData.mockReturnValue({ id: 'user-id' });
    mocks.useUnpauseApplicationMutation.mockReturnValue([
      mocks.unpauseApplication,
    ]);
    mocks.execPromiseWithErrorToast.mockImplementation(
      async (call: () => Promise<unknown>) => {
        try {
          return await call();
        } catch {
          return null;
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays loading until the mutation and project refetches finish', async () => {
    const mutation = createDeferred<unknown>();
    const projectWithStateRefetch = createDeferred<void>();
    const projectRefetch = createDeferred<void>();

    mocks.unpauseApplication.mockReturnValue(mutation.promise);
    mocks.refetchQueries.mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === 'projectWithState') {
          return projectWithStateRefetch.promise;
        }

        return projectRefetch.promise;
      },
    );

    const { result } = renderHook(() => useUnpauseApplication(), { wrapper });
    let unpausePromise!: Promise<void>;

    act(() => {
      unpausePromise = result.current.onUnpause();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
    expect(mocks.unpauseApplication).toHaveBeenCalledWith({
      variables: { appId: 'project-id' },
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: 'user-id' },
        },
      ],
      awaitRefetchQueries: true,
    });

    await act(async () => {
      mutation.resolve({});
      await mutation.promise;
    });

    await waitFor(() => {
      expect(mocks.refetchQueries).toHaveBeenCalledTimes(2);
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      projectWithStateRefetch.resolve();
      await projectWithStateRefetch.promise;
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      projectRefetch.resolve();
      await unpausePromise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mocks.refetchQueries).toHaveBeenCalledWith(
      {
        queryKey: ['projectWithState', 'project-subdomain'],
        exact: true,
      },
      { throwOnError: true },
    );
    expect(mocks.refetchQueries).toHaveBeenCalledWith(
      {
        queryKey: ['project', 'project-subdomain'],
        exact: true,
      },
      { throwOnError: true },
    );
    expect(mocks.track).toHaveBeenCalledWith('Project Resumed', {
      org_id: 'organization-id',
      project_id: 'project-id',
    });
  });

  it('stops loading when the mutation fails', async () => {
    const mutation = createDeferred<unknown>();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.unpauseApplication.mockReturnValue(mutation.promise);

    const { result } = renderHook(() => useUnpauseApplication(), { wrapper });
    let unpausePromise!: Promise<void>;

    act(() => {
      unpausePromise = result.current.onUnpause();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      mutation.reject(new Error('Unpause failed'));
      await unpausePromise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mocks.refetchQueries).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
