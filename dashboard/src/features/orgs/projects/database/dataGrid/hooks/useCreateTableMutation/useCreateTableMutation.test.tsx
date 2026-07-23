import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { queryClient, renderHook } from '@/tests/testUtils';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import useCreateTableMutation from './useCreateTableMutation';

// testUtils stubs NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL, so resolve the
// migrations endpoint the same way the hook does.
const MIGRATIONS_URL = getHasuraMigrationsApiUrl();

const HASURA = 'https://local.hasura.local.nhost.run';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const table: DatabaseTable = {
  name: 'test_table',
  columns: [
    { name: 'id', type: 'uuid' },
    { name: 'name', type: 'text' },
  ],
  primaryKey: ['id'],
};

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  useIsConstellationEnabled: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock(
  '@/features/orgs/projects/common/hooks/useIsConstellationEnabled',
  () => ({
    useIsConstellationEnabled: mocks.useIsConstellationEnabled,
  }),
);

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

let queryBody: unknown = null;
let migrationBody: unknown = null;

const server = setupServer(
  http.post(`${HASURA}/v2/query`, async ({ request }) => {
    queryBody = await request.json();
    return HttpResponse.json([
      { affected_rows: 0 },
      { result_type: 'CommandOk' },
    ]);
  }),
  http.post(MIGRATIONS_URL, async ({ request }) => {
    migrationBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
);

describe('useCreateTableMutation', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    queryBody = null;
    migrationBody = null;
    mocks.useProject.mockReturnValue({ project });
    mocks.useRouter.mockReturnValue({ query: {} });
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: false,
      loading: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  function wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  it('routes through the migrations API on local (non-constellation) dev', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: false,
      loading: false,
    });

    const { result } = renderHook(
      () => useCreateTableMutation({ dataSource: 'default', schema: 'public' }),
      { wrapper },
    );

    await result.current.mutateAsync({ table });

    expect(migrationBody).not.toBeNull();
    expect(queryBody).toBeNull();
  });

  it('routes through the query API when constellation is enabled', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: true,
      loading: false,
    });

    const { result } = renderHook(
      () => useCreateTableMutation({ dataSource: 'default', schema: 'public' }),
      { wrapper },
    );

    await result.current.mutateAsync({ table });

    expect(queryBody).toEqual({
      type: 'bulk',
      version: 1,
      args: [
        {
          type: 'run_sql',
          args: {
            source: 'default',
            sql: 'CREATE TABLE public.test_table (id uuid NOT NULL, name text NOT NULL, PRIMARY KEY (id));',
            cascade: true,
            read_only: false,
          },
        },
      ],
    });
    expect(migrationBody).toBeNull();
  });

  it('routes through the query API on the platform', async () => {
    mocks.useIsPlatform.mockReturnValue(true);

    const { result } = renderHook(
      () => useCreateTableMutation({ dataSource: 'default', schema: 'public' }),
      { wrapper },
    );

    await result.current.mutateAsync({ table });

    expect(queryBody).not.toBeNull();
    expect(migrationBody).toBeNull();
  });
});
