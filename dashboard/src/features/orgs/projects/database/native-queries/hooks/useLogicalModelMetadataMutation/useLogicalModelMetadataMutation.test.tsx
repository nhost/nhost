import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import {
  type LogicalModelMutationArgs,
  useLogicalModelMetadataMutation,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const SOURCE = 'analytics';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const args: LogicalModelMutationArgs = {
  name: 'renamed_result',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};
const original: LogicalModelItem = {
  name: 'result',
  fields: [{ name: 'id', type: { scalar: 'text', nullable: true } }],
  select_permissions: [
    { role: 'user', permission: { columns: '*', filter: {} } },
    { role: 'viewer', permission: { columns: ['id'], filter: {} } },
  ],
};
const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  refetch: vi.fn(),
  supportedSources: ['analytics'] as string[],
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
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources',
  () => ({
    useGetSupportedNativeQuerySources: () => ({
      data: mocks.supportedSources,
    }),
  }),
);

interface MetadataCommand {
  type?: string;
  args?: unknown;
}

const ATOMIC_METADATA_COMMANDS = new Set([
  'pg_track_logical_model',
  'pg_untrack_logical_model',
  'pg_track_native_query',
  'pg_untrack_native_query',
]);
const PERMISSION_COMMANDS = new Set([
  'pg_create_logical_model_select_permission',
  'pg_drop_logical_model_select_permission',
]);

const isMetadataCommand = (value: unknown): value is MetadataCommand =>
  typeof value === 'object' && value !== null;

const getMetadataCommands = (value: unknown): MetadataCommand[] =>
  Array.isArray(value) ? value.filter(isMetadataCommand) : [];

const supportsAtomicGroups = (command: MetadataCommand): boolean => {
  const children = getMetadataCommands(command.args);
  if (command.type === 'bulk_atomic') {
    return children.every(
      (child) =>
        child.type !== undefined && ATOMIC_METADATA_COMMANDS.has(child.type),
    );
  }

  return children.every(supportsAtomicGroups);
};

const hasPermissionCommand = (command: MetadataCommand): boolean =>
  (command.type !== undefined && PERMISSION_COMMANDS.has(command.type)) ||
  getMetadataCommands(command.args).some(hasPermissionCommand);

const flattenMetadataCommands = (
  commands: MetadataCommand[],
): MetadataCommand[] =>
  commands.flatMap((command) => [
    command,
    ...flattenMetadataCommands(getMetadataCommands(command.args)),
  ]);

const migrationSuccess = { name: '0_update_native_query_metadata' };
let metadataBodies: unknown[] = [];
let migrationBodies: unknown[] = [];
let unexpectedRequests: string[] = [];
let metadataStatus = 200;
let migrationStatus = 200;
let permissionStatus = 200;
let migrationFinished: Promise<void> | undefined;

const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    const body = await request.json();
    if (!mocks.useIsPlatform()) {
      unexpectedRequests.push(`Local metadata write: ${JSON.stringify(body)}`);
      return HttpResponse.json(
        { error: 'Unexpected local metadata write' },
        { status: 500 },
      );
    }
    metadataBodies.push(body);

    if (!isMetadataCommand(body) || !supportsAtomicGroups(body)) {
      return HttpResponse.json(
        { error: 'Bulk atomic does not support this command' },
        { status: 500 },
      );
    }
    if (permissionStatus !== 200 && hasPermissionCommand(body)) {
      return HttpResponse.json(
        { error: 'permission failed' },
        { status: permissionStatus },
      );
    }

    return metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
    const body = await request.json();
    migrationBodies.push(body);
    const commands =
      typeof body === 'object' && body !== null && 'up' in body
        ? getMetadataCommands(body.up)
        : [];

    if (!commands.every(supportsAtomicGroups)) {
      return HttpResponse.json(
        { error: 'Bulk atomic does not support this command' },
        { status: 500 },
      );
    }
    if (permissionStatus !== 200 && commands.some(hasPermissionCommand)) {
      return HttpResponse.json(
        { error: 'permission failed' },
        { status: permissionStatus },
      );
    }

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

const replacementStep = {
  type: 'bulk_atomic',
  args: [
    {
      type: 'pg_untrack_logical_model',
      args: { source: SOURCE, name: original.name },
    },
    { type: 'pg_track_logical_model', args: { ...args, source: SOURCE } },
  ],
};
const permissionSteps = original.select_permissions?.map(
  ({ role, permission }) => ({
    type: 'pg_create_logical_model_select_permission',
    args: {
      source: SOURCE,
      name: args.name,
      role,
      permission,
    },
  }),
);
const untrackOriginal = {
  type: 'pg_untrack_logical_model',
  args: { source: SOURCE, name: original.name },
};
const untrackReplacement = {
  type: 'pg_untrack_logical_model',
  args: { source: SOURCE, name: args.name },
};
const restoreOriginal = {
  type: 'pg_track_logical_model',
  args: { source: SOURCE, name: original.name, fields: original.fields },
};
const originalPermissionSteps =
  original.select_permissions?.map(({ role, permission }) => ({
    type: 'pg_create_logical_model_select_permission',
    args: { source: SOURCE, name: original.name, role, permission },
  })) ?? [];

const cases = [
  {
    type: 'add' as const,
    variables: { source: SOURCE, args },
    operationType: 'bulk_atomic',
    expectedArgs: [
      { type: 'pg_track_logical_model', args: { ...args, source: SOURCE } },
    ],
    expectedName: `track_logical_model_${args.name}`,
    expectedDown: [{ type: 'bulk_atomic', args: [untrackReplacement] }],
  },
  {
    type: 'edit' as const,
    variables: { source: SOURCE, args, original },
    operationType: 'bulk',
    expectedArgs: [replacementStep, ...(permissionSteps ?? [])],
    expectedName: `update_logical_model_${original.name}`,
    expectedDown: [
      { type: 'bulk_atomic', args: [untrackReplacement, restoreOriginal] },
      ...originalPermissionSteps,
    ],
  },
  {
    type: 'delete' as const,
    variables: { source: SOURCE, original },
    operationType: 'bulk_atomic',
    expectedArgs: [untrackOriginal],
    expectedName: `untrack_logical_model_${original.name}`,
    expectedDown: [
      { type: 'bulk_atomic', args: [restoreOriginal] },
      ...originalPermissionSteps,
    ],
  },
];

describe('useLogicalModelMetadataMutation', () => {
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
    unexpectedRequests = [];
    metadataStatus = 200;
    migrationStatus = 200;
    permissionStatus = 200;
    migrationFinished = undefined;
    mocks.useProject.mockReturnValue({ project });
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.supportedSources = [SOURCE];
    mocks.refetch.mockReset().mockResolvedValue({ data: 91 });
  });
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    expect(unexpectedRequests).toEqual([]);
  });
  afterAll(() => server.close());

  it('models the relevant engine atomic allowlist in the request handlers', () => {
    const permissionStep = permissionSteps?.[0];

    expect(
      supportsAtomicGroups({
        type: 'bulk_atomic',
        args: [permissionStep],
      }),
    ).toBe(false);
    expect(
      supportsAtomicGroups({
        type: 'bulk',
        args: [replacementStep, permissionStep],
      }),
    ).toBe(true);
  });

  it.each(
    cases,
  )('executes local $type as one awaited migration and invalidates the cache', async ({
    type,
    variables,
    operationType,
    expectedArgs,
    expectedName,
    expectedDown,
  }) => {
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );
    const completion = Promise.withResolvers<void>();
    migrationFinished = completion.promise;
    const mutation = result.current.mutateAsync(variables as never);

    try {
      await waitFor(() => expect(migrationBodies).toHaveLength(1));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(mocks.refetch).toHaveBeenCalledOnce();
      expect(migrationBodies).toEqual([
        {
          name: expectedName,
          datasource: SOURCE,
          up:
            operationType === 'bulk_atomic'
              ? [{ type: 'bulk_atomic', args: expectedArgs }]
              : expectedArgs,
          down: expectedDown,
        },
      ]);
      expect(metadataBodies).toEqual([]);
    } finally {
      completion.resolve();
      await expect(mutation).resolves.toEqual(migrationSuccess);
    }
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    });
  });

  it('fetches a fresh resource version for consecutive platform mutations', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    mocks.refetch
      .mockResolvedValueOnce({ data: 91 })
      .mockResolvedValueOnce({ data: 92 });
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ source: SOURCE, args });
    await result.current.mutateAsync({ source: SOURCE, args });

    expect(
      metadataBodies.map(
        (body) => (body as { resource_version: number }).resource_version,
      ),
    ).toEqual([91, 92]);
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
    expect(migrationBodies).toEqual([]);
  });

  it.each(cases)('performs metadata only for platform $type', async ({
    type,
    variables,
    operationType,
    expectedArgs,
  }) => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync(variables as never),
    ).resolves.toEqual({ message: 'success' });
    expect(metadataBodies).toEqual([
      {
        type: operationType,
        resource_version: 91,
        args: expectedArgs,
      },
    ]);
    expect(migrationBodies).toEqual([]);
  });

  it.each([
    false,
    true,
  ])('edits a model without permissions through the nested shape (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({
      source: SOURCE,
      args,
      original: { ...original, select_permissions: [] },
    });

    if (isPlatform) {
      expect(metadataBodies).toEqual([
        {
          type: 'bulk',
          resource_version: 91,
          args: [replacementStep],
        },
      ]);
      expect(migrationBodies).toEqual([]);
      return;
    }

    expect(migrationBodies).toEqual([
      {
        name: `update_logical_model_${original.name}`,
        datasource: SOURCE,
        up: [replacementStep],
        down: [
          { type: 'bulk_atomic', args: [untrackReplacement, restoreOriginal] },
        ],
      },
    ]);
    expect(metadataBodies).toEqual([]);
  });

  it.each(
    cases,
  )('does not migrate or call success for platform metadata failure on $type', async ({
    type,
    variables,
  }) => {
    mocks.useIsPlatform.mockReturnValue(true);
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
    expect(migrationBodies).toEqual([]);
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
        useLogicalModelMetadataMutation({
          type,
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync(variables as never),
    ).rejects.toThrow('migration failed');
    expect(migrationBodies).toHaveLength(1);
    expect(metadataBodies).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    migrationStatus = 200;
    await expect(
      result.current.mutateAsync(variables as never),
    ).resolves.toEqual(migrationSuccess);
    expect(migrationBodies).toHaveLength(2);
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it.each([
    false,
    true,
  ])('propagates a mocked permission replay failure (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    permissionStatus = 500;
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type: 'edit',
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: SOURCE, args, original }),
    ).rejects.toThrow('permission failed');
    expect(metadataBodies).toHaveLength(isPlatform ? 1 : 0);
    expect(migrationBodies).toHaveLength(isPlatform ? 0 : 1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([
    false,
    true,
  ])('keeps the metadata version guard (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    mocks.refetch.mockResolvedValue({ data: undefined });
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'delete' }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: SOURCE, original }),
    ).rejects.toThrow('Could not load the latest metadata version.');
    expect(metadataBodies).toEqual([]);
    expect(migrationBodies).toEqual([]);
  });

  it.each([
    false,
    true,
  ])('rejects failed metadata refreshes even when stale version data exists (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    mocks.refetch.mockResolvedValue({
      data: 91,
      error: new Error('Metadata refresh failed'),
    });
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'delete' }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: SOURCE, original }),
    ).rejects.toThrow('Metadata refresh failed');
    expect(metadataBodies).toEqual([]);
    expect(migrationBodies).toEqual([]);
  });

  it('rejects an empty source before reading or writing metadata', async () => {
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: '', args }),
    ).rejects.toThrow('A data source is required.');
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(metadataBodies).toEqual([]);
    expect(migrationBodies).toEqual([]);
  });

  it.each([
    { source: 'missing', availability: 'missing' },
    { source: 'mysql', availability: 'unsupported' },
  ])('rejects a non-empty $availability source before platform or local side effects', async ({
    source,
  }) => {
    for (const isPlatform of [false, true]) {
      mocks.useIsPlatform.mockReturnValue(isPlatform);
      const onSuccess = vi.fn();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result, unmount } = renderHook(
        () =>
          useLogicalModelMetadataMutation({
            type: 'add',
            mutationOptions: { onSuccess },
          }),
        { wrapper },
      );

      await expect(
        result.current.mutateAsync({ source, args }),
      ).rejects.toThrow('The selected data source is unavailable.');
      expect(mocks.refetch).not.toHaveBeenCalled();
      expect(metadataBodies).toEqual([]);
      expect(migrationBodies).toEqual([]);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      unmount();
    }
  });

  it.each([
    false,
    true,
  ])('blocks delete after the source is removed from refreshed metadata (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result, rerender } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type: 'delete',
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    mocks.supportedSources = [];
    rerender();

    await expect(
      result.current.mutateAsync({ source: SOURCE, original }),
    ).rejects.toThrow('The selected data source is unavailable.');
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(metadataBodies).toEqual([]);
    expect(migrationBodies).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('stays pending until metadata invalidation settles', async () => {
    const onSuccess = vi.fn();
    const invalidation = Promise.withResolvers<void>();
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValueOnce(
      invalidation.promise,
    );
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type: 'add',
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    let settled = false;
    const mutation = result.current
      .mutateAsync({ source: SOURCE, args })
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

  it('keeps permission replay outside atomic groups without native-query cascades', async () => {
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ source: SOURCE, args, original });
    const body = migrationBodies[0] as { up: MetadataCommand[] };
    const commands = flattenMetadataCommands(body.up);
    const atomicGroups = commands.filter(
      (command) => command.type === 'bulk_atomic',
    );

    expect(atomicGroups).toHaveLength(1);
    expect(
      getMetadataCommands(atomicGroups[0].args).map((command) => command.type),
    ).toEqual(['pg_untrack_logical_model', 'pg_track_logical_model']);
    expect(
      getMetadataCommands(atomicGroups[0].args).some(hasPermissionCommand),
    ).toBe(false);
    expect(
      commands.every((command) => !command.type?.includes('native_query')),
    ).toBe(true);
  });
});
