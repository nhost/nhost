import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useLogicalModelPermissionMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import { LocalMetadataPersistenceError } from '@/features/orgs/projects/database/native-queries/utils/execute-metadata-mutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { CreateLogicalModelSelectPermissionArgs } from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const args: CreateLogicalModelSelectPermissionArgs = {
  source: 'default',
  name: 'author_result',
  role: 'user',
  permission: { columns: '*', filter: {} },
};
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

interface MetadataRequest {
  type?: string;
  resource_version?: number;
}

let metadataBodies: MetadataRequest[] = [];
let requestOrder: string[] = [];
let exportRequests = 0;
let exportMetadataRequests = 0;
let nextResourceVersion = 244;
let metadataStatus = 200;
let exportStatus = 200;
let exportMetadataStatus = 200;
let resolveExport: VoidFunction | undefined;

const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    const body = (await request.json()) as MetadataRequest;
    metadataBodies.push(body);

    if (body.type === 'export_metadata') {
      requestOrder.push('resource-version');
      exportMetadataRequests += 1;
      return exportMetadataStatus === 200
        ? HttpResponse.json({
            resource_version: nextResourceVersion,
            metadata: {},
          })
        : HttpResponse.json(
            { error: 'resource version failed' },
            { status: 500 },
          );
    }

    requestOrder.push('metadata');
    return metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
  }),
  http.get(`${API}/apis/metadata`, async ({ request }) => {
    requestOrder.push('export');
    exportRequests += 1;
    expect(new URL(request.url).searchParams.toString()).toBe('export=true');
    if (resolveExport) {
      await new Promise<void>((resolve) => {
        resolveExport = resolve;
      });
    }
    return exportStatus === 200
      ? HttpResponse.json({ resource_version: 245, metadata: {} })
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
    expectedArgs: [
      {
        type: 'pg_create_logical_model_select_permission',
        args,
      },
    ],
  },
  {
    type: 'edit' as const,
    variables: { args },
    expectedArgs: [
      {
        type: 'pg_drop_logical_model_select_permission',
        args: { source: 'default', name: args.name, role: args.role },
      },
      {
        type: 'pg_create_logical_model_select_permission',
        args,
      },
    ],
  },
  {
    type: 'delete' as const,
    variables: { name: args.name, role: args.role },
    expectedArgs: [
      {
        type: 'pg_drop_logical_model_select_permission',
        args: { source: 'default', name: args.name, role: args.role },
      },
    ],
  },
];

async function waitForInitialResourceVersion() {
  await waitFor(() =>
    expect(
      queryClient.getQueryState([EXPORT_METADATA_QUERY_KEY, project.subdomain]),
    ).toMatchObject({ status: 'success', fetchStatus: 'idle' }),
  );
  metadataBodies = [];
  requestOrder = [];
  exportMetadataRequests = 0;
}

describe('useLogicalModelPermissionMutation', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    queryClient.clear();
    server.resetHandlers();
    metadataBodies = [];
    requestOrder = [];
    exportRequests = 0;
    exportMetadataRequests = 0;
    nextResourceVersion = 244;
    metadataStatus = 200;
    exportStatus = 200;
    exportMetadataStatus = 200;
    resolveExport = undefined;
    mocks.useProject.mockReturnValue({ project, loading: false });
    mocks.useIsPlatform.mockReturnValue(false);
  });
  afterAll(() => server.close());

  it.each(
    cases,
  )('executes local $type as fresh bulk metadata then one awaited export', async ({
    type,
    variables,
    expectedArgs,
  }) => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useLogicalModelPermissionMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );
    await waitForInitialResourceVersion();
    resolveExport = vi.fn();
    const mutation = result.current.mutateAsync(variables as never);

    await waitFor(() => expect(exportRequests).toBe(1));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(requestOrder).toEqual(['resource-version', 'metadata', 'export']);
    expect(metadataBodies).toEqual([
      { type: 'export_metadata', version: 2, args: {} },
      {
        type: 'bulk',
        resource_version: 244,
        args: expectedArgs,
      },
    ]);

    resolveExport?.();
    await mutation;
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(exportRequests).toBe(1);
  });

  it('fetches a fresh resource version for consecutive mutations', async () => {
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'add' }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    await result.current.mutateAsync({ args });
    await waitFor(() =>
      expect(
        queryClient.getQueryState([
          EXPORT_METADATA_QUERY_KEY,
          project.subdomain,
        ])?.fetchStatus,
      ).toBe('idle'),
    );
    nextResourceVersion = 245;
    await result.current.mutateAsync({ args });

    expect(exportMetadataRequests).toBeGreaterThanOrEqual(2);
    expect(
      metadataBodies
        .filter((body) => body.type === 'bulk')
        .map((body) => body.resource_version),
    ).toEqual([244, 245]);
    expect(exportRequests).toBe(2);
  });

  it.each(cases)('performs fresh metadata only for platform $type', async ({
    type,
    variables,
    expectedArgs,
  }) => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    await result.current.mutateAsync(variables as never);

    expect(requestOrder.slice(0, 2)).toEqual(['resource-version', 'metadata']);
    expect(metadataBodies.filter((body) => body.type === 'bulk')).toEqual([
      {
        type: 'bulk',
        resource_version: 244,
        args: expectedArgs,
      },
    ]);
    expect(exportMetadataRequests).toBeGreaterThanOrEqual(1);
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
        useLogicalModelPermissionMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    await expect(
      result.current.mutateAsync(variables as never),
    ).rejects.toThrow('metadata failed');
    expect(requestOrder).toEqual(['resource-version', 'metadata']);
    expect(exportRequests).toBe(0);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(
    cases,
  )('does not mutate, export, or call success for version failure on $type', async ({
    type,
    variables,
  }) => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useLogicalModelPermissionMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    exportMetadataStatus = 500;
    await expect(
      result.current.mutateAsync(variables as never),
    ).rejects.toThrow('resource version failed');
    expect(requestOrder).toEqual(['resource-version']);
    expect(exportRequests).toBe(0);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(
    cases,
  )('surfaces partial success and refetches metadata once for $type export failure', async ({
    type,
    variables,
  }) => {
    exportStatus = 500;
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useLogicalModelPermissionMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    const error = await result.current
      .mutateAsync(variables as never)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(LocalMetadataPersistenceError);
    expect(error).toHaveProperty(
      'message',
      'Hasura metadata was updated, but it could not be saved to local metadata files.',
    );
    expect(error).toHaveProperty(
      'cause',
      expect.objectContaining({ message: 'export failed' }),
    );
    expect(requestOrder).toEqual([
      'resource-version',
      'metadata',
      'export',
      'resource-version',
    ]);
    expect(exportMetadataRequests).toBe(2);
    expect(exportRequests).toBe(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps the persistence error when the real metadata refresh fails', async () => {
    exportStatus = 500;
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'delete' }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    let metadataRequestCount = 0;
    server.use(
      http.post(`${API}/v1/metadata`, async ({ request }) => {
        const body = (await request.json()) as MetadataRequest;
        metadataBodies.push(body);
        if (body.type === 'export_metadata') {
          requestOrder.push('resource-version');
          exportMetadataRequests += 1;
          metadataRequestCount += 1;
          return metadataRequestCount === 1
            ? HttpResponse.json({ resource_version: 244, metadata: {} })
            : HttpResponse.json({ error: 'refresh failed' }, { status: 500 });
        }
        requestOrder.push('metadata');
        return HttpResponse.json({ message: 'success' });
      }),
    );

    const error = await result.current
      .mutateAsync({ name: args.name, role: args.role })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(LocalMetadataPersistenceError);
    expect(error).toHaveProperty(
      'message',
      'Hasura metadata was updated, but it could not be saved to local metadata files.',
    );
    expect(error).toHaveProperty(
      'cause',
      expect.objectContaining({ message: 'export failed' }),
    );
    expect(requestOrder).toEqual([
      'resource-version',
      'metadata',
      'export',
      'resource-version',
    ]);
    expect(exportMetadataRequests).toBe(2);
    expect(exportRequests).toBe(1);
  });
});
