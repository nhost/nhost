import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { NativeQueryItem, TrackNativeQueryArgs } from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
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
  object_relationships: [{
    name: 'external',
    using: { column_mapping: { id: 'id' }, insertion_order: null, remote_native_query: 'other' },
  }],
};
const args: TrackNativeQueryArgs = {
  source: 'default',
  root_field_name: 'renamed_authors',
  type: 'query',
  arguments: {},
  code: 'SELECT * FROM authors',
  returns: 'author_result',
  object_relationships: original.object_relationships,
};
const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({ useProject: mocks.useProject }));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({ useIsPlatform: mocks.useIsPlatform }));
vi.mock('@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion', () => ({
  useGetMetadataResourceVersion: () => ({ refetch: mocks.refetch }),
}));

let metadataBody: unknown;
let migrationBody: unknown;
const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    metadataBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
    migrationBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useNativeQueryMetadataMutation', () => {
  beforeAll(() => server.listen());
  beforeEach(() => {
    queryClient.clear();
    server.resetHandlers();
    metadataBody = undefined;
    migrationBody = undefined;
    mocks.useProject.mockReturnValue({ project });
    mocks.refetch.mockResolvedValue({ data: 117 });
  });
  afterAll(() => server.close());

  it('awaits a fresh version and sends platform edits in untrack/track bulk_atomic order', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });

    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(metadataBody).toEqual({
      type: 'bulk_atomic',
      resource_version: 117,
      args: [
        { type: 'pg_untrack_native_query', args: { source: 'default', root_field_name: original.root_field_name } },
        { type: 'pg_track_native_query', args },
      ],
    });
  });

  it('sends local edits with a lossless inverse-ordered rollback', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });

    expect(migrationBody).toMatchObject({
      name: 'update_native_query_authors',
      datasource: 'default',
      skip_execution: false,
      up: [
        { type: 'pg_untrack_native_query', args: { root_field_name: original.root_field_name } },
        { type: 'pg_track_native_query', args },
      ],
      down: [
        { type: 'pg_untrack_native_query', args: { root_field_name: args.root_field_name } },
        {
          type: 'pg_track_native_query',
          args: {
            root_field_name: original.root_field_name,
            arguments: original.arguments,
            object_relationships: original.object_relationships,
          },
        },
      ],
    });
  });

  it('restores the complete original query in a local delete rollback', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type: 'delete' }),
      { wrapper },
    );
    await result.current.mutateAsync({ original });
    expect(migrationBody).toMatchObject({
      name: 'delete_native_query_authors',
      down: [{ type: 'pg_track_native_query', args: { ...original, source: 'default', arguments: original.arguments } }],
    });
  });

  it('invalidates metadata only after success', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => useNativeQueryMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({
      queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
    }));

    invalidate.mockClear();
    server.use(http.post(`${API}/apis/migrate`, () => HttpResponse.json({ error: 'failed' }, { status: 500 })));
    await expect(result.current.mutateAsync({ args })).rejects.toThrow('failed');
    expect(invalidate).not.toHaveBeenCalled();
  });
});
