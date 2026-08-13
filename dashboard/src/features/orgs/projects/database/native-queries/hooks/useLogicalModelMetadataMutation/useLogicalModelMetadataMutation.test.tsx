import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { LocalMetadataPersistenceError } from '@/features/orgs/projects/database/native-queries/utils/execute-metadata-mutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const args: TrackLogicalModelArgs = {
  source: 'default',
  name: 'renamed_result',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};
const original: LogicalModelItem = {
  name: 'result',
  fields: [{ name: 'id', type: { scalar: 'text', nullable: true } }],
  select_permissions: [
    { role: 'user', permission: { columns: '*', filter: {} } },
  ],
};
const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));
vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({ useGetMetadataResourceVersion: () => ({ refetch: mocks.refetch }) }),
);

let metadataBodies: unknown[] = [];
let requestOrder: string[] = [];
let exportRequests = 0;
let metadataStatus = 200;
let exportStatus = 200;
let resolveExport: VoidFunction | undefined;

const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    requestOrder.push('metadata');
    metadataBodies.push(await request.json());
    return metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
  }),
  http.get(`${API}/apis/metadata`, async () => {
    requestOrder.push('export');
    exportRequests += 1;
    if (resolveExport) {
      await new Promise<void>((resolve) => {
        resolveExport = resolve;
      });
    }
    return exportStatus === 200
      ? HttpResponse.json({ resource_version: 93, metadata: {} })
      : HttpResponse.json({ error: 'export failed' }, { status: 500 });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const cases = [
  {
    type: 'add' as const,
    variables: { args },
    expectedArgs: [{ type: 'pg_track_logical_model', args }],
  },
  {
    type: 'edit' as const,
    variables: { args, original },
    expectedArgs: [
      {
        type: 'pg_untrack_logical_model',
        args: { source: 'default', name: original.name },
      },
      { type: 'pg_track_logical_model', args },
      {
        type: 'pg_create_logical_model_select_permission',
        args: {
          source: 'default',
          name: args.name,
          role: 'user',
          permission: original.select_permissions?.[0].permission,
        },
      },
    ],
  },
  {
    type: 'delete' as const,
    variables: { original },
    expectedArgs: [
      {
        type: 'pg_untrack_logical_model',
        args: { source: 'default', name: original.name },
      },
    ],
  },
];

describe('useLogicalModelMetadataMutation', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    queryClient.clear();
    metadataBodies = [];
    requestOrder = [];
    exportRequests = 0;
    metadataStatus = 200;
    exportStatus = 200;
    resolveExport = undefined;
    mocks.useProject.mockReturnValue({ project });
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.refetch.mockReset().mockResolvedValue({ data: 91 });
  });
  afterAll(() => server.close());

  it.each(
    cases,
  )('executes local $type as fresh bulk_atomic metadata then one awaited export', async ({
    type,
    variables,
    expectedArgs,
  }) => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );
    resolveExport = vi.fn();
    const mutation = result.current.mutateAsync(variables as never);

    await waitFor(() => expect(exportRequests).toBe(1));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(requestOrder).toEqual(['metadata', 'export']);
    expect(metadataBodies[0]).toEqual({
      type: 'bulk_atomic',
      resource_version: 91,
      args: expectedArgs,
    });

    resolveExport?.();
    await mutation;
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('fetches a fresh resource version for consecutive mutations', async () => {
    mocks.refetch
      .mockResolvedValueOnce({ data: 91 })
      .mockResolvedValueOnce({ data: 92 });
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args });
    await result.current.mutateAsync({ args });

    expect(
      metadataBodies.map(
        (body) => (body as { resource_version: number }).resource_version,
      ),
    ).toEqual([91, 92]);
    expect(exportRequests).toBe(2);
  });

  it.each(cases)('performs metadata only for platform $type', async ({
    type,
    variables,
  }) => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type }),
      { wrapper },
    );

    await result.current.mutateAsync(variables as never);
    expect(metadataBodies).toHaveLength(1);
    expect(exportRequests).toBe(0);
  });

  it.each(
    cases,
  )('does not export or call success for metadata failure on $type', async ({
    type,
    variables,
  }) => {
    metadataStatus = 500;
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync(variables as never),
    ).rejects.toThrow('metadata failed');
    expect(exportRequests).toBe(0);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(
    cases,
  )('surfaces partial success and refreshes once for $type export failure', async ({
    type,
    variables,
  }) => {
    exportStatus = 500;
    const onSuccess = vi.fn();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    const error = await result.current
      .mutateAsync(variables as never)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(LocalMetadataPersistenceError);
    expect(error).toHaveProperty(
      'cause',
      expect.objectContaining({ message: 'export failed' }),
    );
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith(
      {
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
        refetchType: 'all',
      },
      { throwOnError: true },
    );
    expect(exportRequests).toBe(1);
    expect(onSuccess).not.toHaveBeenCalled();
    invalidate.mockRestore();
  });

  it('keeps the persistence error when refresh fails', async () => {
    exportStatus = 500;
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockRejectedValue(new Error('refresh failed'));
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'delete' }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ original }),
    ).rejects.toBeInstanceOf(LocalMetadataPersistenceError);
    invalidate.mockRestore();
  });

  it('does not add a native-query rename cascade to logical-model edits', async () => {
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });
    const body = metadataBodies[0] as { args: Array<{ type: string }> };
    expect(body.args.every((step) => !step.type.includes('native_query'))).toBe(
      true,
    );
  });
});
