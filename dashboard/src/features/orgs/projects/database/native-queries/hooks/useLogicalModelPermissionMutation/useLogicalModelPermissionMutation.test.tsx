import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useLogicalModelPermissionMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import type { LogicalModelPermissionArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const args: LogicalModelPermissionArgs = {
  name: 'author_result',
  role: 'user',
  permission: {
    columns: ['id', 'name'],
    filter: {
      _or: [
        { id: { _eq: 'X-Hasura-User-Id' } },
        { profile: { active: { _eq: true } } },
      ],
    },
  },
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

const migrationSuccess = { name: '0_update_native_query_metadata' };
let metadataBodies: MetadataRequest[] = [];
let migrationBodies: unknown[] = [];
let requestOrder: string[] = [];
let unexpectedRequests: string[] = [];
let exportMetadataRequests = 0;
let nextResourceVersion: number | undefined = 244;
let metadataStatus = 200;
let migrationStatus = 200;
let exportMetadataStatus = 200;
let migrationFinished: Promise<void> | undefined;

const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    const isPlatform = mocks.useIsPlatform();
    const body = (await request.json()) as MetadataRequest;
    metadataBodies.push(body);

    if (body.type === 'export_metadata') {
      requestOrder.push('resource-version');
      exportMetadataRequests += 1;
      return exportMetadataStatus === 200
        ? HttpResponse.json({
            resource_version: nextResourceVersion,
            metadata: {
              sources: [
                { name: 'default', kind: 'postgres' },
                { name: 'analytics', kind: 'postgres' },
                { name: 'sqlite', kind: 'sqlite' },
              ],
            },
          })
        : HttpResponse.json(
            { error: 'resource version failed' },
            { status: 500 },
          );
    }

    if (!isPlatform) {
      unexpectedRequests.push(`Local metadata write: ${JSON.stringify(body)}`);
      return HttpResponse.json(
        { error: 'Unexpected local metadata write' },
        { status: 500 },
      );
    }
    requestOrder.push('metadata');
    return metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
    requestOrder.push('migration');
    migrationBodies.push(await request.json());
    await migrationFinished;
    return migrationStatus === 200
      ? HttpResponse.json(migrationSuccess)
      : HttpResponse.json({ error: 'migration failed' }, { status: 500 });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const original = { columns: ['id'], filter: {} };
const cases = ['default', 'analytics'].flatMap((source) => {
  const dropStep = {
    type: 'pg_drop_logical_model_select_permission',
    args: { source, name: args.name, role: args.role },
  };
  const createStep = {
    type: 'pg_create_logical_model_select_permission',
    args: { ...args, source },
  };
  const restoreStep = {
    type: 'pg_create_logical_model_select_permission',
    args: { ...args, source, permission: original },
  };
  return [
    {
      source,
      type: 'add' as const,
      variables: { source, args },
      expectedArgs: [createStep],
      expectedName: `create_logical_model_select_permission_${args.name}_${args.role}`,
      expectedDown: [dropStep],
    },
    {
      source,
      type: 'edit' as const,
      variables: { source, args, original },
      expectedArgs: [dropStep, createStep],
      expectedName: `update_logical_model_select_permission_${args.name}_${args.role}`,
      expectedDown: [dropStep, restoreStep],
    },
    {
      source,
      type: 'delete' as const,
      variables: { source, name: args.name, role: args.role, original },
      expectedArgs: [dropStep],
      expectedName: `drop_logical_model_select_permission_${args.name}_${args.role}`,
      expectedDown: [restoreStep],
    },
  ];
});

async function waitForResourceVersion() {
  await waitFor(() =>
    expect(
      queryClient.getQueryState([EXPORT_METADATA_QUERY_KEY, project.subdomain]),
    ).toMatchObject({ status: 'success', fetchStatus: 'idle' }),
  );
}

async function waitForInitialResourceVersion() {
  await waitForResourceVersion();
  metadataBodies = [];
  requestOrder = [];
  exportMetadataRequests = 0;
}

const metadataQueryKey = [EXPORT_METADATA_QUERY_KEY, project.subdomain];

describe('useLogicalModelPermissionMutation', () => {
  beforeAll(() =>
    server.listen({
      onUnhandledRequest(request, print) {
        unexpectedRequests.push(`${request.method} ${request.url}`);
        print.error();
      },
    }),
  );
  beforeEach(() => {
    queryClient.clear();
    metadataBodies = [];
    migrationBodies = [];
    requestOrder = [];
    unexpectedRequests = [];
    exportMetadataRequests = 0;
    nextResourceVersion = 244;
    metadataStatus = 200;
    migrationStatus = 200;
    exportMetadataStatus = 200;
    migrationFinished = undefined;
    mocks.useProject.mockReturnValue({ project, loading: false });
    mocks.useIsPlatform.mockReturnValue(false);
  });
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    queryClient.clear();
    expect(unexpectedRequests).toEqual([]);
  });
  afterAll(() => server.close());

  it.each(
    cases,
  )('executes local $source $type as ordered direct migration steps and waits before success/invalidation', async ({
    source,
    type,
    variables,
    expectedArgs,
    expectedName,
    expectedDown,
  }) => {
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useLogicalModelPermissionMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );
    await waitForInitialResourceVersion();
    const completion = Promise.withResolvers<void>();
    migrationFinished = completion.promise;
    const mutation = result.current.mutateAsync(variables as never);

    try {
      await waitFor(() => expect(migrationBodies).toHaveLength(1));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(requestOrder).toEqual(['resource-version', 'migration']);
      expect(metadataBodies).toEqual([
        { type: 'export_metadata', version: 2, args: {} },
      ]);
      expect(migrationBodies).toEqual([
        {
          name: expectedName,
          datasource: source,
          up: expectedArgs,
          down: expectedDown,
        },
      ]);
    } finally {
      completion.resolve();
      await expect(mutation).resolves.toEqual(migrationSuccess);
    }
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess.mock.calls[0][0]).toEqual(migrationSuccess);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: metadataQueryKey,
    });
    await waitForResourceVersion();
    expect(requestOrder).toEqual([
      'resource-version',
      'migration',
      'resource-version',
    ]);
  });

  it.each([
    false,
    true,
  ])('fetches a fresh snapshot for consecutive mutations (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'add' }),
      { wrapper },
    );

    await waitForInitialResourceVersion();
    await result.current.mutateAsync({ source: 'default', args });
    await waitForResourceVersion();
    nextResourceVersion = 245;
    await result.current.mutateAsync({ source: 'default', args });
    await waitForResourceVersion();

    const transport = isPlatform ? 'metadata' : 'migration';
    expect(requestOrder).toEqual([
      'resource-version',
      transport,
      'resource-version',
      'resource-version',
      transport,
      'resource-version',
    ]);
    expect(exportMetadataRequests).toBe(4);
    expect(
      metadataBodies
        .filter((body) => body.type === 'bulk')
        .map((body) => body.resource_version),
    ).toEqual(isPlatform ? [244, 245] : []);
    expect(migrationBodies).toHaveLength(isPlatform ? 0 : 2);
  });

  it.each(
    cases,
  )('performs fresh ordinary bulk metadata only for platform $source $type', async ({
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
    await expect(
      result.current.mutateAsync(variables as never),
    ).resolves.toEqual({ message: 'success' });
    await waitForResourceVersion();

    expect(requestOrder).toEqual([
      'resource-version',
      'metadata',
      'resource-version',
    ]);
    expect(metadataBodies.filter((body) => body.type === 'bulk')).toEqual([
      {
        type: 'bulk',
        resource_version: 244,
        args: expectedArgs,
      },
    ]);
    expect(migrationBodies).toEqual([]);
  });

  it.each(
    cases,
  )('does not migrate, invalidate, or call success for platform metadata failure on $type', async ({
    type,
    variables,
  }) => {
    mocks.useIsPlatform.mockReturnValue(true);
    metadataStatus = 500;
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
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
    expect(migrationBodies).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(
    cases,
  )('surfaces local $type failure without invalidating and permits an explicit retry', async ({
    type,
    variables,
  }) => {
    migrationStatus = 500;
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
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
    ).rejects.toThrow('migration failed');
    expect(requestOrder).toEqual(['resource-version', 'migration']);
    expect(migrationBodies).toHaveLength(1);
    expect(metadataBodies).toEqual([
      { type: 'export_metadata', version: 2, args: {} },
    ]);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    migrationStatus = 200;
    await expect(
      result.current.mutateAsync(variables as never),
    ).resolves.toEqual(migrationSuccess);
    await waitForResourceVersion();
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1]).toEqual(migrationBodies[0]);
    expect(requestOrder).toEqual([
      'resource-version',
      'migration',
      'resource-version',
      'migration',
      'resource-version',
    ]);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: metadataQueryKey,
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  describe.each([
    false,
    true,
  ])('metadata guards (platform: %s)', (isPlatform) => {
    it.each(
      cases,
    )('does not mutate, invalidate, or call success for version failure on $type', async ({
      type,
      variables,
    }) => {
      mocks.useIsPlatform.mockReturnValue(isPlatform);
      const onSuccess = vi.fn();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
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
      expect(migrationBodies).toEqual([]);
      expect(invalidate).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it.each([
      '',
      'missing',
      'sqlite',
    ])('rejects unavailable source %s without writing', async (source) => {
      mocks.useIsPlatform.mockReturnValue(isPlatform);
      const { result } = renderHook(
        () => useLogicalModelPermissionMutation({ type: 'add' }),
        { wrapper },
      );
      await waitForInitialResourceVersion();
      await expect(
        result.current.mutateAsync({ source, args }),
      ).rejects.toThrow();
      expect(requestOrder).toEqual([]);
      expect(migrationBodies).toEqual([]);
    });

    it('rejects a snapshot without a metadata version', async () => {
      mocks.useIsPlatform.mockReturnValue(isPlatform);
      const onSuccess = vi.fn();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(
        () =>
          useLogicalModelPermissionMutation({
            type: 'delete',
            mutationOptions: { onSuccess },
          }),
        { wrapper },
      );

      await waitForInitialResourceVersion();
      nextResourceVersion = undefined;
      await expect(
        result.current.mutateAsync({
          source: 'default',
          name: args.name,
          role: args.role,
          original,
        }),
      ).rejects.toThrow('Could not load the latest metadata version.');
      expect(requestOrder).toEqual(['resource-version']);
      expect(migrationBodies).toEqual([]);
      expect(invalidate).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it('stays pending until metadata invalidation settles', async () => {
    const onSuccess = vi.fn();
    const invalidation = Promise.withResolvers<void>();
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValueOnce(
      invalidation.promise,
    );
    const { result } = renderHook(
      () =>
        useLogicalModelPermissionMutation({
          type: 'add',
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );
    await waitForInitialResourceVersion();

    let settled = false;
    const mutation = result.current
      .mutateAsync({ source: 'default', args })
      .finally(() => {
        settled = true;
      });

    await waitFor(() => expect(migrationBodies).toHaveLength(1));
    expect(settled).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();

    invalidation.resolve();
    await expect(mutation).resolves.toEqual(migrationSuccess);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
