import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import type { FetchDatabaseReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery/fetchDatabase';
import useDatabaseQuery from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery/useDatabaseQuery';
import { renderHook, waitFor } from '@/tests/testUtils';

const DATABASE_QUERY_KEY = ['default'];

const oldDatabase: FetchDatabaseReturnType = {
  tableLikeObjects: [
    {
      table_name: 'old_table',
      table_schema: 'public',
      table_type: 'ORDINARY TABLE',
      updatability: 0,
    },
  ],
};

const freshDatabase: FetchDatabaseReturnType = {
  tableLikeObjects: [
    {
      table_name: 'restored_table',
      table_schema: 'public',
      table_type: 'ORDINARY TABLE',
      updatability: 0,
    },
  ],
};

const mocks = vi.hoisted(() => ({
  fetchDatabase: vi.fn(),
  useProject: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery/fetchDatabase',
  () => ({ default: mocks.fetchDatabase }),
);

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

describe('useDatabaseQuery', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(DATABASE_QUERY_KEY, oldDatabase);
    mocks.fetchDatabase.mockResolvedValue(freshDatabase);
    mocks.useProject.mockReturnValue({
      project: {
        subdomain: 'test-project',
        region: { domain: 'nhost.run' },
        config: { hasura: { adminSecret: 'test-secret' } },
      },
    });
    mocks.useRouter.mockReturnValue({
      isReady: true,
      query: { dataSourceSlug: 'default' },
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('refetches fresh database metadata on mount while cached data is still fresh', async () => {
    const { result } = renderHook(() => useDatabaseQuery(DATABASE_QUERY_KEY), {
      wrapper,
    });

    expect(result.current.data).toEqual(oldDatabase);

    await waitFor(() => {
      expect(mocks.fetchDatabase).toHaveBeenCalledOnce();
      expect(result.current.data).toEqual(freshDatabase);
    });
  });

  it('allows callers to override the mount refetch default', () => {
    const { result } = renderHook(
      () =>
        useDatabaseQuery(DATABASE_QUERY_KEY, {
          queryOptions: { refetchOnMount: false },
        }),
      { wrapper },
    );

    expect(result.current.data).toEqual(oldDatabase);
    expect(mocks.fetchDatabase).not.toHaveBeenCalled();
  });
});
