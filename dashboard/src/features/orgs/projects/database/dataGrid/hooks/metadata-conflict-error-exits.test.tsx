import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useDeleteDatabaseObjectWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation';
import { useRefreshMaterializedView } from '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedView';
import { mockMatchMediaValue } from '@/tests/mocks';
import { act, renderHook, screen, waitFor } from '@/tests/testUtils';

const HASURA_APP_URL = 'http://hasura.example.test';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const DIRECT_CONFLICT = {
  path: '$',
  error: CONFLICT_MESSAGE,
  code: 'conflict',
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'users',
    },
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: () => ({
    appUrl: HASURA_APP_URL,
    adminSecret: 'not-recorded-in-errors',
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));

let requestCount = 0;
const server = setupServer(
  http.post(`${HASURA_APP_URL}/v2/query`, () => {
    requestCount += 1;
    return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
  }),
);
let queryClient: QueryClient;

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      {children}
    </QueryClientProvider>
  );
}

async function expectOneConflictToast() {
  await waitFor(() => {
    expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  });
  expect(screen.getByText(CONFLICT_MESSAGE)).toBeInTheDocument();
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  requestCount = 0;
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
  vi.clearAllMocks();
});

afterAll(() => server.close());

it('routes database-object deletion conflicts to the persistent error toast', async () => {
  const { result } = renderHook(
    () => useDeleteDatabaseObjectWithToastMutation(),
    { wrapper },
  );

  await act(async () => {
    await expect(
      result.current.mutateAsync({
        schema: 'public',
        objectName: 'users',
        type: 'ORDINARY TABLE',
      }),
    ).rejects.toMatchObject({
      name: 'MetadataVersionConflictError',
      message: CONFLICT_MESSAGE,
    });
  });

  await expectOneConflictToast();
  expect(requestCount).toBe(1);
});

it('routes materialized-view refresh conflicts to the persistent error toast', async () => {
  const refetch = vi.fn();
  const { result } = renderHook(() => useRefreshMaterializedView({ refetch }), {
    wrapper,
  });

  await act(async () => {
    await result.current.handleRefresh();
  });

  await expectOneConflictToast();
  expect(requestCount).toBe(1);
  expect(refetch).not.toHaveBeenCalled();
});
