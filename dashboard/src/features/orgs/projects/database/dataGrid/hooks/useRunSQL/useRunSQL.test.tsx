import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import useRunSQL from '@/features/orgs/projects/database/dataGrid/hooks/useRunSQL/useRunSQL';
import { mockMatchMediaValue } from '@/tests/mocks';
import { act, renderHook, screen, waitFor } from '@/tests/testUtils';

const originalEnv = { ...process.env };
const HASURA_APP_URL = 'http://hasura.example.test';
const MIGRATION_URL = 'http://migrations.example.test/apis/migrate';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const TWO_TABLES_SQL = [
  'CREATE TABLE public.users (id int);',
  'CREATE TABLE public.teams (id int);',
].join('\n');
const DIRECT_CONFLICT = {
  path: '$',
  error: CONFLICT_MESSAGE,
  code: 'conflict',
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useAdminApiTarget: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useUserData: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/orgs/example/projects/example/database',
    query: { dataSourceSlug: 'default' },
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: mocks.useAdminApiTarget,
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery',
  () => ({
    useDatabaseQuery: () => ({ refetch: mocks.refetch }),
  }),
);
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));
vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

let sqlRequestCount = 0;
let metadataRequestCount = 0;
let migrationRequestCount = 0;

const server = setupServer();
let queryClient: QueryClient;

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      {children}
    </QueryClientProvider>
  );
}

function setDirectConflictHandler() {
  server.use(
    http.post(`${HASURA_APP_URL}/v2/query`, () => {
      sqlRequestCount += 1;
      return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
    }),
  );
}

function setMigrationConflictHandler() {
  server.use(
    http.post(MIGRATION_URL, () => {
      migrationRequestCount += 1;
      return HttpResponse.json(
        {
          code: 'data_api_error',
          message: JSON.stringify(DIRECT_CONFLICT),
        },
        { status: 400 },
      );
    }),
  );
}

async function expectTerminalConflict(
  runSQL: () => Promise<boolean>,
  getState: () => { loading: boolean; commandOk: boolean },
) {
  let succeeded: boolean | undefined;
  await act(async () => {
    succeeded = await runSQL();
  });

  expect(succeeded).toBe(false);
  await waitFor(() => {
    expect(getState().loading).toBe(false);
  });
  expect(getState().commandOk).toBe(false);
  expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
  expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: MIGRATION_URL,
  };
  sqlRequestCount = 0;
  metadataRequestCount = 0;
  migrationRequestCount = 0;
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.spyOn(queryClient, 'invalidateQueries');
  mocks.refetch.mockResolvedValue({ data: [] });
  mocks.useAdminApiTarget.mockReturnValue({
    appUrl: HASURA_APP_URL,
    adminSecret: 'not-recorded-in-errors',
  });
  mocks.useProject.mockReturnValue({
    project: { id: 'project-id', subdomain: 'example' },
  });
  mocks.useUserData.mockReturnValue({ id: 'user-id' });
});

afterEach(() => {
  process.env = { ...originalEnv };
  server.resetHandlers();
  toast.remove();
  vi.clearAllMocks();
});

afterAll(() => server.close());

it('terminates a direct SQL conflict without invalidation or replay', async () => {
  mocks.useIsPlatform.mockReturnValue(true);
  setDirectConflictHandler();
  const { result } = renderHook(
    () =>
      useRunSQL(
        'CREATE TABLE public.users (id int);',
        false,
        false,
        false,
        false,
        '',
      ),
    { wrapper },
  );

  await expectTerminalConflict(result.current.runSQL, () => result.current);

  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(0);
  expect(migrationRequestCount).toBe(0);
});

it('terminates a migration conflict using the configured Hasura identity', async () => {
  mocks.useIsPlatform.mockReturnValue(false);
  setMigrationConflictHandler();
  const { result } = renderHook(
    () =>
      useRunSQL(
        'CREATE TABLE public.users (id int);',
        false,
        false,
        false,
        true,
        'create_users',
      ),
    { wrapper },
  );

  await expectTerminalConflict(result.current.runSQL, () => result.current);

  expect(migrationRequestCount).toBe(1);
  expect(sqlRequestCount).toBe(0);
  expect(metadataRequestCount).toBe(0);
});

it('prioritizes a delayed direct tracking conflict over an earlier ordinary failure', async () => {
  mocks.useIsPlatform.mockReturnValue(true);
  let resolveConflict!: VoidFunction;
  const conflictBlocked = new Promise<void>((resolve) => {
    resolveConflict = resolve;
  });
  server.use(
    http.post(`${HASURA_APP_URL}/v2/query`, () => {
      sqlRequestCount += 1;
      return HttpResponse.json({ result_type: 'CommandOk', result: null });
    }),
    http.post(`${HASURA_APP_URL}/v1/metadata`, async () => {
      metadataRequestCount += 1;
      if (metadataRequestCount === 1) {
        return HttpResponse.error();
      }

      await conflictBlocked;
      return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
    }),
  );
  const { result } = renderHook(
    () => useRunSQL(TWO_TABLES_SQL, true, false, false, false, ''),
    { wrapper },
  );

  let runSQLPromise!: Promise<boolean>;
  act(() => {
    runSQLPromise = result.current.runSQL();
  });

  await waitFor(() => {
    expect(metadataRequestCount).toBe(2);
  });
  expect(result.current.loading).toBe(true);
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

  await act(async () => {
    resolveConflict();
  });
  await expectTerminalConflict(
    () => runSQLPromise,
    () => result.current,
  );

  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(2);
  expect(migrationRequestCount).toBe(0);
});

it('prioritizes a delayed local tracking conflict over an earlier ordinary failure', async () => {
  mocks.useIsPlatform.mockReturnValue(false);
  let resolveConflict!: VoidFunction;
  const conflictBlocked = new Promise<void>((resolve) => {
    resolveConflict = resolve;
  });
  server.use(
    http.post(`${HASURA_APP_URL}/v2/query`, () => {
      sqlRequestCount += 1;
      return HttpResponse.json({ result_type: 'CommandOk', result: null });
    }),
    http.post(MIGRATION_URL, async () => {
      migrationRequestCount += 1;
      if (migrationRequestCount === 1) {
        return HttpResponse.error();
      }

      await conflictBlocked;
      return HttpResponse.json(
        {
          code: 'data_api_error',
          message: JSON.stringify(DIRECT_CONFLICT),
        },
        { status: 400 },
      );
    }),
  );
  const { result } = renderHook(
    () => useRunSQL(TWO_TABLES_SQL, true, false, false, false, ''),
    { wrapper },
  );

  let runSQLPromise!: Promise<boolean>;
  act(() => {
    runSQLPromise = result.current.runSQL();
  });

  await waitFor(() => {
    expect(migrationRequestCount).toBe(2);
  });
  expect(result.current.loading).toBe(true);
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

  await act(async () => {
    resolveConflict();
  });
  await expectTerminalConflict(
    () => runSQLPromise,
    () => result.current,
  );

  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(0);
  expect(migrationRequestCount).toBe(2);
});

it('does not report success or replay SQL when tracking conflicts after SQL succeeds', async () => {
  mocks.useIsPlatform.mockReturnValue(true);
  let resolveMetadataRequest!: VoidFunction;
  const metadataRequestBlocked = new Promise<void>((resolve) => {
    resolveMetadataRequest = resolve;
  });
  server.use(
    http.post(`${HASURA_APP_URL}/v2/query`, () => {
      sqlRequestCount += 1;
      return HttpResponse.json({ result_type: 'CommandOk', result: null });
    }),
    http.post(`${HASURA_APP_URL}/v1/metadata`, async () => {
      metadataRequestCount += 1;
      await metadataRequestBlocked;
      return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
    }),
  );
  const { result } = renderHook(
    () =>
      useRunSQL(
        'CREATE TABLE public.users (id int);',
        true,
        false,
        false,
        false,
        '',
      ),
    { wrapper },
  );

  let runSQLPromise!: Promise<boolean>;
  act(() => {
    runSQLPromise = result.current.runSQL();
  });

  await waitFor(() => {
    expect(metadataRequestCount).toBe(1);
  });
  expect(result.current.loading).toBe(true);
  expect(result.current.commandOk).toBe(false);
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

  let succeeded: boolean | undefined;
  await act(async () => {
    resolveMetadataRequest();
    succeeded = await runSQLPromise;
  });

  expect(succeeded).toBe(false);
  expect(result.current.loading).toBe(false);
  expect(result.current.commandOk).toBe(false);
  expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
  expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(1);
  expect(migrationRequestCount).toBe(0);
});
