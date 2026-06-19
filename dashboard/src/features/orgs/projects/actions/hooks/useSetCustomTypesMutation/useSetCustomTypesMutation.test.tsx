import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { HASURA_API_URL } from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import useSetCustomTypesMutation from './useSetCustomTypesMutation';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const customTypes: CustomTypes = {
  scalars: [],
  enums: [],
  input_objects: [
    { name: 'SampleInput', fields: [{ name: 'username', type: 'String!' }] },
  ],
  objects: [],
};

const variables = { customTypes, previousCustomTypes: {} };

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

let metadataBody: unknown = null;
let migrationBody: { name: string; up: unknown } | null = null;

const server = setupServer(
  http.post(`${HASURA_API_URL}/v1/metadata`, async ({ request }) => {
    metadataBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSetCustomTypesMutation', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    metadataBody = null;
    migrationBody = null;
    mocks.useProject.mockReturnValue({ project });
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(() => server.close());

  it('on platform, persists custom types via the metadata bulk API', async () => {
    mocks.useIsPlatform.mockReturnValue(true);

    const { result } = renderHook(() => useSetCustomTypesMutation(), { wrapper });
    await result.current.mutateAsync(variables);

    expect(metadataBody).toEqual({
      type: 'bulk',
      args: [{ type: 'set_custom_types', args: customTypes }],
    });
    expect(migrationBody).toBeNull();
  });

  it('off platform, persists custom types via the migrations API', async () => {
    mocks.useIsPlatform.mockReturnValue(false);

    const { result } = renderHook(() => useSetCustomTypesMutation(), { wrapper });
    await result.current.mutateAsync(variables);

    expect(migrationBody?.name).toBe('update_custom_types');
    expect(migrationBody?.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
    ]);
    expect(metadataBody).toBeNull();
  });

  it('invalidates the export-metadata cache on success', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetCustomTypesMutation(), { wrapper });
    await result.current.mutateAsync(variables);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      }),
    );
  });
});
