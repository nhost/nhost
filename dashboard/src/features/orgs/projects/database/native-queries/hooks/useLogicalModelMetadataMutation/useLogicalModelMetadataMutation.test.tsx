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
vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => ({ data: mocks.supportedSources }),
}));

const migrationSuccess = { name: '0_update_native_query_metadata' };
let metadataBodies: unknown[] = [];
let migrationBodies: unknown[] = [];
let unexpectedRequests: string[] = [];
let metadataStatus = 200;
let migrationStatus = 200;
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

    return metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
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
    args: { source: SOURCE, name: args.name, role, permission },
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

  it.each(cases)(
    'executes local $type as one awaited migration and invalidates the cache',
    async ({
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
    },
  );

  it.each(cases)(
    'performs metadata only for platform $type',
    async ({ type, variables, operationType, expectedArgs }) => {
      mocks.useIsPlatform.mockReturnValue(true);
      const { result } = renderHook(
        () => useLogicalModelMetadataMutation({ type }),
        { wrapper },
      );

      await expect(
        result.current.mutateAsync(variables as never),
      ).resolves.toEqual({ message: 'success' });
      expect(metadataBodies).toEqual([
        { type: operationType, resource_version: 91, args: expectedArgs },
      ]);
      expect(migrationBodies).toEqual([]);
    },
  );

  it('does not migrate or call success for a platform metadata failure', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    metadataStatus = 500;
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type: 'add',
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: SOURCE, args }),
    ).rejects.toThrow('metadata failed');
    expect(migrationBodies).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('surfaces a local failure without invalidating and permits an explicit retry', async () => {
    migrationStatus = 500;
    const onSuccess = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useLogicalModelMetadataMutation({
          type: 'add',
          mutationOptions: { onSuccess },
        }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: SOURCE, args }),
    ).rejects.toThrow('migration failed');
    expect(migrationBodies).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    migrationStatus = 200;
    await expect(
      result.current.mutateAsync({ source: SOURCE, args }),
    ).resolves.toEqual(migrationSuccess);
    expect(migrationBodies).toHaveLength(2);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('keeps the metadata version guard', async () => {
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
    { source: '', message: 'A data source is required.' },
    { source: 'missing', message: 'The selected data source is unavailable.' },
  ])(
    'rejects source "$source" before reading or writing metadata',
    async ({ source, message }) => {
      const { result } = renderHook(
        () => useLogicalModelMetadataMutation({ type: 'add' }),
        { wrapper },
      );

      await expect(
        result.current.mutateAsync({ source, args }),
      ).rejects.toThrow(message);
      expect(mocks.refetch).not.toHaveBeenCalled();
      expect(metadataBodies).toEqual([]);
      expect(migrationBodies).toEqual([]);
    },
  );
});
