import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import { queryClient, renderHook } from '@/tests/testUtils';
import useUpdateRemoteSchemaMutation from './useUpdateRemoteSchemaMutation';

// testUtils stubs NEXT_PUBLIC_NHOST_HASURA_API_URL, so the hook's appUrl
// resolves to this host for both the direct metadata and migration endpoints.
const HASURA = 'https://local.hasura.local.nhost.run';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const remoteSchema: RemoteSchemaInfo = {
  name: 'test_schema',
  definition: { url: 'https://example.com/graphql' },
};

// Superset of the direct and migration variables so a single call satisfies
// whichever path routing selects.
const variables = {
  updatedRemoteSchema: remoteSchema,
  originalRemoteSchema: remoteSchema,
  resourceVersion: 1,
};

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  useIsConstellationEnabled: vi.fn(),
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

let metadataBody: unknown = null;
let migrationBody: unknown = null;

const server = setupServer(
  http.post(`${HASURA}/v1/metadata`, async ({ request }) => {
    metadataBody = await request.json();
    return HttpResponse.json({});
  }),
  http.post(`${HASURA}/apis/migrate`, async ({ request }) => {
    migrationBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
);

describe('useUpdateRemoteSchemaMutation', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    metadataBody = null;
    migrationBody = null;
    mocks.useProject.mockReturnValue({ project });
    mocks.useIsPlatform.mockReturnValue(false);
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

  it('routes through the migrations API when constellation is disabled (non-platform)', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: false,
      loading: false,
    });

    const { result } = renderHook(() => useUpdateRemoteSchemaMutation(), {
      wrapper,
    });

    await result.current.mutateAsync(variables);

    expect(migrationBody).not.toBeNull();
    expect(metadataBody).toBeNull();
  });

  it('routes through the metadata API when constellation is enabled', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: true,
      loading: false,
    });

    const { result } = renderHook(() => useUpdateRemoteSchemaMutation(), {
      wrapper,
    });

    await result.current.mutateAsync(variables);

    expect(metadataBody).not.toBeNull();
    expect(migrationBody).toBeNull();
  });

  it('routes through the metadata API while the constellation check is in-flight (undefined)', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: undefined,
      loading: true,
    });

    const { result } = renderHook(() => useUpdateRemoteSchemaMutation(), {
      wrapper,
    });

    await result.current.mutateAsync(variables);

    expect(metadataBody).not.toBeNull();
    expect(migrationBody).toBeNull();
  });

  it('routes through the metadata API on the platform', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    mocks.useIsConstellationEnabled.mockReturnValue({
      isConstellationEnabled: false,
      loading: false,
    });

    const { result } = renderHook(() => useUpdateRemoteSchemaMutation(), {
      wrapper,
    });

    await result.current.mutateAsync(variables);

    expect(metadataBody).not.toBeNull();
    expect(migrationBody).toBeNull();
  });
});
