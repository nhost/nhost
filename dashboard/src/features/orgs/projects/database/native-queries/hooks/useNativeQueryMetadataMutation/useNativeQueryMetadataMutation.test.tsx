import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import {
  type NativeQueryMutationArgs,
  useNativeQueryMetadataMutation,
} from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const SOURCE = 'analytics';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const original: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: { limit: { type: 'integer', nullable: true } },
  code: 'SELECT * FROM authors LIMIT {{limit}}',
  returns: 'author_result',
  object_relationships: [
    {
      name: 'external',
      using: {
        column_mapping: { id: 'id' },
        insertion_order: null,
        remote_native_query: 'other',
      },
    },
  ],
  array_relationships: [
    {
      name: 'external_array',
      using: {
        column_mapping: { id: 'author_id' },
        insertion_order: 'after_parent',
        remote_native_query: 'other',
      },
    },
  ],
};
const args: NativeQueryMutationArgs = {
  root_field_name: 'renamed_authors',
  type: 'query',
  arguments: { search: { type: 'text', nullable: false } },
  code: 'SELECT * FROM authors WHERE name ILIKE {{search}}',
  returns: 'author_result',
  description: 'Searches authors by name',
  object_relationships: original.object_relationships,
  array_relationships: original.array_relationships,
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

const untrackOriginal = {
  type: 'pg_untrack_native_query',
  args: { source: SOURCE, root_field_name: original.root_field_name },
};
const untrackReplacement = {
  type: 'pg_untrack_native_query',
  args: { source: SOURCE, root_field_name: args.root_field_name },
};
const restoreOriginal = {
  type: 'pg_track_native_query',
  args: { ...original, source: SOURCE },
};

const cases = [
  {
    type: 'add' as const,
    variables: { source: SOURCE, args },
    expectedArgs: [
      { type: 'pg_track_native_query', args: { ...args, source: SOURCE } },
    ],
    expectedName: `track_native_query_${args.root_field_name}`,
    expectedDown: [{ type: 'bulk_atomic', args: [untrackReplacement] }],
  },
  {
    type: 'edit' as const,
    variables: { source: SOURCE, args, original },
    expectedArgs: [
      untrackOriginal,
      { type: 'pg_track_native_query', args: { ...args, source: SOURCE } },
    ],
    expectedName: `update_native_query_${original.root_field_name}`,
    expectedDown: [
      { type: 'bulk_atomic', args: [untrackReplacement, restoreOriginal] },
    ],
  },
  {
    type: 'delete' as const,
    variables: { source: SOURCE, original },
    expectedArgs: [untrackOriginal],
    expectedName: `untrack_native_query_${original.root_field_name}`,
    expectedDown: [{ type: 'bulk_atomic', args: [restoreOriginal] }],
  },
];

describe('useNativeQueryMetadataMutation', () => {
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

  it.each(
    cases,
  )('executes local $type as one awaited atomic migration and invalidates the cache', async ({
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
        useNativeQueryMetadataMutation({
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
          up: [{ type: 'bulk_atomic', args: expectedArgs }],
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
      () => useNativeQueryMetadataMutation({ type: 'add' }),
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
    expectedArgs,
  }) => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync(variables as never),
    ).resolves.toEqual({ message: 'success' });
    expect(metadataBodies).toEqual([
      {
        type: 'bulk_atomic',
        resource_version: 91,
        args: expectedArgs,
      },
    ]);
    expect(migrationBodies).toEqual([]);
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
        useNativeQueryMetadataMutation({
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
        useNativeQueryMetadataMutation({
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

  it('rejects an empty source before reading or writing metadata', async () => {
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type: 'add' }),
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
          useNativeQueryMetadataMutation({
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
        useNativeQueryMetadataMutation({
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

  it.each([
    false,
    true,
  ])('keeps the metadata version guard (platform: %s)', async (isPlatform) => {
    mocks.useIsPlatform.mockReturnValue(isPlatform);
    mocks.refetch.mockResolvedValue({ data: undefined });
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type: 'delete' }),
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
      () => useNativeQueryMetadataMutation({ type: 'delete' }),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ source: SOURCE, original }),
    ).rejects.toThrow('Metadata refresh failed');
    expect(metadataBodies).toEqual([]);
    expect(migrationBodies).toEqual([]);
  });

  it('stays pending until metadata invalidation settles', async () => {
    const onSuccess = vi.fn();
    const invalidation = Promise.withResolvers<void>();
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValueOnce(
      invalidation.promise,
    );
    const { result } = renderHook(
      () =>
        useNativeQueryMetadataMutation({
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
});
