import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { AddComputedFieldArgs } from '@/utils/hasura-api/generated/schemas';
import useComputedFieldMetadataMutation from './useComputedFieldMetadataMutation';

const HASURA = 'https://local.hasura.local.nhost.run';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const args: AddComputedFieldArgs = {
  table: { schema: 'public', name: 'users' },
  name: 'full_name',
  definition: { function: { schema: 'public', name: 'compute_full_name' } },
  source: 'default',
};

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: mocks.useGetMetadataResourceVersion,
  }),
);

let metadataBody: unknown = null;
let migrationBody: unknown = null;

const server = setupServer(
  http.post(`${HASURA}/v1/metadata`, async ({ request }) => {
    metadataBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
  http.post(`${HASURA}/apis/migrate`, async ({ request }) => {
    migrationBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useComputedFieldMetadataMutation', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    metadataBody = null;
    migrationBody = null;
    mocks.useProject.mockReturnValue({ project });
    mocks.useGetMetadataResourceVersion.mockReturnValue({
      refetch: vi.fn().mockResolvedValue({ data: 7 }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('on platform, routes "add" through the metadata API with the refetched resource version', async () => {
    mocks.useIsPlatform.mockReturnValue(true);

    const { result } = renderHook(
      () => useComputedFieldMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args });

    expect(metadataBody).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 7,
      args: [{ type: 'pg_add_computed_field', args }],
    });
    expect(migrationBody).toBeNull();
  });

  it('off platform, routes "add" through the migrations API', async () => {
    mocks.useIsPlatform.mockReturnValue(false);

    const { result } = renderHook(
      () => useComputedFieldMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args });

    const body = migrationBody as {
      name: string;
      up: Array<{ type: string; args: AddComputedFieldArgs }>;
    };
    expect(body.name).toBe('add_computed_field_public_users_full_name');
    expect(body.up).toEqual([{ type: 'pg_add_computed_field', args }]);
    expect(metadataBody).toBeNull();
  });

  it('on success, invalidates the export-metadata cache scoped to the project subdomain', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useComputedFieldMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      });
    });
  });
});
