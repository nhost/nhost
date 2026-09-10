import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import useSetTableTrackingMutation from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation/useSetTableTrackingMutation';
import { queryClient, renderHook } from '@/tests/testUtils';
import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';

const originalEnv = { ...process.env };
const MIGRATION_URL = 'http://migration.local.test:9693/apis/migrate';
const HASURA_APP_URL = 'http://hasura.local.test:8080';
const ADMIN_SECRET = 'super-secret-token';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';

const mocks = vi.hoisted(() => ({
  useAdminApiTarget: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: mocks.useAdminApiTarget,
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

let migrationRequestCount = 0;
let metadataRequestCount = 0;

const server = setupServer(
  http.post(MIGRATION_URL, () => {
    migrationRequestCount += 1;
    return HttpResponse.json(
      {
        code: 'data_api_error',
        message: JSON.stringify({
          path: '$',
          error: CONFLICT_MESSAGE,
          code: 'conflict',
        }),
      },
      { status: 400 },
    );
  }),
  http.post(`${HASURA_APP_URL}/v1/metadata`, () => {
    metadataRequestCount += 1;
    return HttpResponse.json({});
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSetTableTrackingMutation in local mode', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: MIGRATION_URL,
    };
    queryClient.clear();
    migrationRequestCount = 0;
    metadataRequestCount = 0;
    mocks.useAdminApiTarget.mockReturnValue({
      appUrl: HASURA_APP_URL,
      adminSecret: ADMIN_SECRET,
    });
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useProject.mockReturnValue({
      project: { subdomain: 'local-project' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  afterAll(() => server.close());

  it('preserves the configured Hasura target through a conflict from a different migration host', async () => {
    const { result } = renderHook(() => useSetTableTrackingMutation(), {
      wrapper,
    });

    let thrown: unknown;
    try {
      await result.current.mutateAsync({
        tracked: true,
        resourceVersion: undefined,
        args: {
          table: { schema: 'public', name: 'users' },
          source: 'default',
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MetadataVersionConflictError);
    expect(thrown).toMatchObject({
      message: CONFLICT_MESSAGE,
      origin: { appUrl: HASURA_APP_URL },
    });
    expect(JSON.stringify(thrown)).not.toContain(ADMIN_SECRET);
    expect(migrationRequestCount).toBe(1);
    expect(metadataRequestCount).toBe(0);
  });
});
